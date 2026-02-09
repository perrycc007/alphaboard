import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = params.search
      ? {
          OR: [
            { ticker: { contains: params.search, mode: 'insensitive' as const } },
            { name: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ticker: 'asc' },
      }),
      this.prisma.stock.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findByTicker(ticker: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { ticker: ticker.toUpperCase() },
      include: {
        stages: { orderBy: { date: 'desc' }, take: 1 },
      },
    });
    if (!stock) throw new NotFoundException(`Stock ${ticker} not found`);
    return stock;
  }

  async getDailyBars(ticker: string, limit = 252) {
    const stock = await this.findByTicker(ticker);
    return this.prisma.stockDaily.findMany({
      where: { stockId: stock.id },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getIntradayBars(ticker: string) {
    const stock = await this.findByTicker(ticker);
    return this.prisma.stockIntraday.findMany({
      where: { stockId: stock.id },
      orderBy: { timestamp: 'asc' },
    });
  }

  async getStageHistory(ticker: string) {
    const stock = await this.findByTicker(ticker);
    return this.prisma.stockStage.findMany({
      where: { stockId: stock.id },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find past market leaders - stocks that entered Stage 2 and had significant
   * price appreciation. Uses batched queries to avoid N+1 performance issue.
   */
  async findLeaders(params: {
    minGain?: number;
    theme?: string;
    days?: number;
    page?: number;
    limit?: number;
  }) {
    const minGain = params.minGain ?? 50;
    const daysBack = params.days ?? 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Find stocks that had Stage 2 entries within the time window
    const stage2Entries = await this.prisma.stockStage.findMany({
      where: {
        stage: 'STAGE_2',
        date: { gte: cutoffDate },
      },
      include: {
        stock: {
          include: {
            themeStocks: {
              include: {
                group: {
                  include: { theme: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
      distinct: ['stockId'],
    });

    if (stage2Entries.length === 0) return [];

    // Batch: fetch all daily bars for all candidate stocks in one query
    const stockIds = stage2Entries.map((e) => e.stockId);
    const allDailyBars = await this.prisma.stockDaily.findMany({
      where: {
        stockId: { in: stockIds },
        date: { gte: cutoffDate },
      },
      orderBy: { date: 'asc' },
      select: {
        stockId: true,
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
      },
    });

    // Group bars by stockId for efficient lookup
    const barsByStock = new Map<
      string,
      typeof allDailyBars
    >();
    for (const bar of allDailyBars) {
      const existing = barsByStock.get(bar.stockId);
      if (existing) {
        existing.push(bar);
      } else {
        barsByStock.set(bar.stockId, [bar]);
      }
    }

    const leaders = [];

    for (const entry of stage2Entries) {
      const bars = barsByStock.get(entry.stockId);
      if (!bars || bars.length === 0) continue;

      // Find entry bar (first bar on or after stage 2 entry date)
      const entryBar = bars.find(
        (b) => b.date.getTime() >= entry.date.getTime(),
      );
      if (!entryBar) continue;

      // Find peak bar (highest high after entry)
      let peakBar = entryBar;
      for (const bar of bars) {
        if (
          bar.date.getTime() >= entryBar.date.getTime() &&
          Number(bar.high) > Number(peakBar.high)
        ) {
          peakBar = bar;
        }
      }

      const entryPrice = Number(entryBar.close);
      const peakPrice = Number(peakBar.high);
      const peakGain = ((peakPrice - entryPrice) / entryPrice) * 100;

      if (peakGain < minGain) continue;

      const duration = Math.round(
        (peakBar.date.getTime() - entryBar.date.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const themeName =
        entry.stock.themeStocks?.[0]?.group?.theme?.name ?? null;

      leaders.push({
        ticker: entry.stock.ticker,
        name: entry.stock.name,
        peakGain: Math.round(peakGain * 10) / 10,
        duration,
        theme: themeName,
        entryDate: entryBar.date.toISOString(),
        peakDate: peakBar.date.toISOString(),
        entryPrice,
        peakPrice,
        stage: entry.stage,
      });
    }

    // Sort by peak gain descending
    leaders.sort((a, b) => b.peakGain - a.peakGain);

    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const total = leaders.length;
    const skip = (page - 1) * limit;
    const items = leaders.slice(skip, skip + limit);

    return { items, total, page, limit };
  }
}
