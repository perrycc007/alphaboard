import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TradableType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelReviewService } from './model/model-review.service';

interface ThemeAssignment {
  themeName?: string;
  groupName?: string;
  role?: string;
  importance?: number;
  isPrimary?: boolean;
}

interface EnrichmentResult {
  briefDescription?: string | null;
  tradableType?: string | null;
  isTradable?: boolean;
  themes?: ThemeAssignment[];
}

export interface EnrichStockOutcome {
  stockId: string;
  ticker: string;
  updated: boolean;
  themesLinked: number;
}

const TRADABLE_TYPES = new Set<string>(['STOCK', 'ETF', 'INDEX', 'COMMODITY_PROXY']);

/**
 * Enriches ticker metadata (description, tradable classification, theme/group
 * membership) via the model provider. With the mock provider this is a no-op
 * that still records the review; real enrichment activates once a key is set.
 */
@Injectable()
export class MetadataEnrichmentService {
  private readonly logger = new Logger(MetadataEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelReview: ModelReviewService,
  ) {}

  async enrichStock(stockId: string, scanRunId?: string): Promise<EnrichStockOutcome> {
    const stock = await this.prisma.stock.findUniqueOrThrow({
      where: { id: stockId },
    });

    const taxonomy = await this.loadKnownTaxonomy();

    const review = await this.modelReview.review({
      reviewType: 'METADATA_ENRICHMENT',
      targetType: 'stock',
      targetId: stock.id,
      scanRunId,
      prompt:
        'Classify this ticker for theme/supply-chain mapping. ' +
        'Prefer themeName/groupName values from knownThemes so the mapping links to the existing taxonomy; ' +
        'only introduce a new theme name when none fits. ' +
        'Return JSON with keys: briefDescription (string), ' +
        'tradableType (one of STOCK, ETF, INDEX, COMMODITY_PROXY), isTradable (boolean), ' +
        'themes (array of {themeName, groupName, role, importance 0-1, isPrimary}).',
      payload: {
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        industry: stock.industry,
        exchange: stock.exchange,
        knownThemes: taxonomy,
      },
    });

    const result = (review.resultJson ?? {}) as EnrichmentResult;
    const data: Prisma.StockUpdateInput = {};
    if (typeof result.briefDescription === 'string') {
      data.briefDescription = result.briefDescription;
    }
    if (
      typeof result.tradableType === 'string' &&
      TRADABLE_TYPES.has(result.tradableType)
    ) {
      data.tradableType = result.tradableType as TradableType;
    }
    if (typeof result.isTradable === 'boolean') {
      data.isTradable = result.isTradable;
    }

    let updated = false;
    if (Object.keys(data).length > 0) {
      await this.prisma.stock.update({ where: { id: stock.id }, data });
      updated = true;
    }

    const themesLinked = await this.linkThemes(stock.id, result.themes ?? []);

    return { stockId: stock.id, ticker: stock.ticker, updated, themesLinked };
  }

  async enrichMissing(limit = 25): Promise<EnrichStockOutcome[]> {
    const stocks = await this.prisma.stock.findMany({
      where: { briefDescription: null, isActive: true },
      take: limit,
      select: { id: true },
    });
    const outcomes: EnrichStockOutcome[] = [];
    for (const s of stocks) {
      outcomes.push(await this.enrichStock(s.id));
    }
    return outcomes;
  }

  /**
   * Enrich only the supplied stocks that are still missing metadata, capped at
   * `limit`. Used by the full scan to enrich fresh focus-list leaders/candidates
   * (attributed to the scan run) rather than the whole table.
   */
  async enrichMissingForStocks(
    stockIds: string[],
    limit = 25,
    scanRunId?: string,
  ): Promise<EnrichStockOutcome[]> {
    if (stockIds.length === 0) return [];
    const stocks = await this.prisma.stock.findMany({
      where: { id: { in: stockIds }, briefDescription: null, isActive: true },
      take: limit,
      select: { id: true },
    });
    const outcomes: EnrichStockOutcome[] = [];
    for (const s of stocks) {
      outcomes.push(await this.enrichStock(s.id, scanRunId));
    }
    return outcomes;
  }

  /** Existing themes with their groups, so the model maps to known taxonomy. */
  private async loadKnownTaxonomy(): Promise<
    Array<{ theme: string; groups: string[] }>
  > {
    const themes = await this.prisma.theme.findMany({
      select: { name: true, groups: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return themes.map((t) => ({
      theme: t.name,
      groups: t.groups.map((g) => g.name),
    }));
  }

  private async linkThemes(
    stockId: string,
    assignments: ThemeAssignment[],
  ): Promise<number> {
    let linked = 0;
    for (const assignment of assignments) {
      if (!assignment.themeName) continue;
      const theme = await this.prisma.theme.findFirst({
        where: { name: assignment.themeName },
        select: { id: true },
      });
      if (!theme) continue;

      let groupId: string | null = null;
      if (assignment.groupName) {
        const group = await this.prisma.supplyChainGroup.findFirst({
          where: { themeId: theme.id, name: assignment.groupName },
          select: { id: true },
        });
        groupId = group?.id ?? null;
      }

      const importance =
        typeof assignment.importance === 'number'
          ? new Prisma.Decimal(Math.max(0, Math.min(1, assignment.importance)))
          : null;

      await this.prisma.tickerThemeMembership.upsert({
        where: { stockId_themeId: { stockId, themeId: theme.id } },
        create: {
          stockId,
          themeId: theme.id,
          groupId,
          roleDescription: assignment.role ?? null,
          importanceScore: importance,
          isPrimaryTheme: assignment.isPrimary ?? false,
          source: 'model',
        },
        update: {
          groupId,
          roleDescription: assignment.role ?? null,
          importanceScore: importance,
          isPrimaryTheme: assignment.isPrimary ?? false,
          reviewedAt: new Date(),
        },
      });
      linked++;
    }
    return linked;
  }
}
