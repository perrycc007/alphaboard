import { Injectable, Logger } from '@nestjs/common';
import { StageEnum, StockCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const DEFAULT_MIN_PRICE = 10;
export const DEFAULT_MIN_AVG_VOLUME = 1_000_000;

/** Sectors treated as commodity/raw-material related. */
const COMMODITY_SECTORS = ['Energy', 'Materials'];

export interface UniverseFilterOptions {
  /** Minimum last close to be considered tradable. Default $10. */
  minPrice?: number;
  /** Minimum average volume to be considered liquid. Default 1M. */
  minAvgVolume?: number;
  /** Tickers always included regardless of liquidity/price (indexes, ETFs, manual pins). */
  pinnedTickers?: string[];
  /** Include current Stage 4 names (only for bearish/short review). Default false. */
  includeStage4?: boolean;
}

export type UniverseReasonCode =
  | 'STAGE_2'
  | 'CURRENT_LEADER'
  | 'PREVIOUS_LEADER'
  | 'COMMODITY'
  | 'MANUAL_PIN';

export interface TradableUniverseCandidate {
  stockId: string;
  ticker: string;
  reasonCodes: UniverseReasonCode[];
  stage: StageEnum | null;
  isPreviousLeader: boolean;
  isCurrentLeader: boolean;
  isCommodityRelated: boolean;
  liquidityPass: boolean;
  pricePass: boolean;
}

/**
 * Decides which tickers may enter setup detection. Runs a loose DB pre-filter,
 * then labels each candidate precisely from its latest stage, leader history,
 * sector, and most recent close.
 *
 * Inclusion (first pass favors false positives over false negatives):
 * - manually pinned tickers are always included
 * - otherwise must pass price AND liquidity, match >= 1 reason, and not be
 *   current Stage 4 (unless `includeStage4` is set for bearish review)
 */
@Injectable()
export class UniverseFilterService {
  private readonly logger = new Logger(UniverseFilterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTradableUniverse(
    options: UniverseFilterOptions = {},
  ): Promise<TradableUniverseCandidate[]> {
    const minPrice = options.minPrice ?? DEFAULT_MIN_PRICE;
    const minAvgVolume = options.minAvgVolume ?? DEFAULT_MIN_AVG_VOLUME;
    const includeStage4 = options.includeStage4 ?? false;
    const pinned = new Set(
      (options.pinnedTickers ?? []).map((t) => t.toUpperCase()),
    );

    const stocks = await this.prisma.stock.findMany({
      where: {
        isActive: true,
        OR: [
          {
            avgVolume: { gte: BigInt(minAvgVolume) },
            OR: [
              { stages: { some: { stage: 'STAGE_2' } } },
              { leaderRuns: { some: { isQualified: true } } },
              { sector: { in: COMMODITY_SECTORS } },
              {
                stages: {
                  some: { category: { in: ['HOT', 'FORMER_HOT', 'COMMODITY'] } },
                },
              },
            ],
          },
          ...(pinned.size > 0
            ? [{ ticker: { in: Array.from(pinned) } }]
            : []),
        ],
      },
      select: {
        id: true,
        ticker: true,
        sector: true,
        avgVolume: true,
        stages: {
          orderBy: { date: 'desc' as const },
          take: 1,
          select: { stage: true, category: true },
        },
        leaderRuns: {
          where: { isQualified: true },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (stocks.length === 0) return [];

    const latestCloseByStock = await this.getLatestCloses(
      stocks.map((s) => s.id),
    );

    const candidates: TradableUniverseCandidate[] = [];

    for (const stock of stocks) {
      const isPinned = pinned.has(stock.ticker.toUpperCase());
      const latest = stock.stages[0];
      const stage = latest?.stage ?? null;
      const category = latest?.category ?? null;
      const close = latestCloseByStock.get(stock.id) ?? null;

      const pricePass = close != null && close >= minPrice;
      const liquidityPass =
        stock.avgVolume != null && Number(stock.avgVolume) >= minAvgVolume;

      const isCurrentLeader = category === StockCategory.HOT;
      const isPreviousLeader =
        category === StockCategory.FORMER_HOT || stock.leaderRuns.length > 0;
      const isCommodityRelated =
        category === StockCategory.COMMODITY ||
        (stock.sector != null && COMMODITY_SECTORS.includes(stock.sector));

      const reasonCodes: UniverseReasonCode[] = [];
      if (stage === StageEnum.STAGE_2) reasonCodes.push('STAGE_2');
      if (isCurrentLeader) reasonCodes.push('CURRENT_LEADER');
      if (isPreviousLeader) reasonCodes.push('PREVIOUS_LEADER');
      if (isCommodityRelated) reasonCodes.push('COMMODITY');
      if (isPinned) reasonCodes.push('MANUAL_PIN');

      const include = isPinned
        ? true
        : pricePass &&
          liquidityPass &&
          reasonCodes.length > 0 &&
          (includeStage4 || stage !== StageEnum.STAGE_4);

      if (!include) continue;

      candidates.push({
        stockId: stock.id,
        ticker: stock.ticker,
        reasonCodes,
        stage,
        isPreviousLeader,
        isCurrentLeader,
        isCommodityRelated,
        liquidityPass,
        pricePass,
      });
    }

    this.logger.log(
      `Tradable universe: ${candidates.length} candidates (minPrice=${minPrice}, minAvgVolume=${minAvgVolume})`,
    );
    return candidates;
  }

  /** Latest close per stock in a single query using distinct-on ordering. */
  private async getLatestCloses(
    stockIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.stockDaily.findMany({
      where: { stockId: { in: stockIds } },
      orderBy: [{ stockId: 'asc' }, { date: 'desc' }],
      distinct: ['stockId'],
      select: { stockId: true, close: true },
    });

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.stockId, Number(row.close));
    }
    return map;
  }
}
