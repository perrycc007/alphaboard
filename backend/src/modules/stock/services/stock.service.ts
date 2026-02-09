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
   * price appreciation. Queries stage transitions paired with daily price data
   * to compute peak gain from Stage 2 entry.
   */
  async findLeaders(params: {
    minGain?: number;
    theme?: string;
    days?: number;
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

    const leaders = [];

    for (const entry of stage2Entries) {
      // Get the price at stage 2 entry and the peak price after
      const [entryBar, peakBar] = await Promise.all([
        this.prisma.stockDaily.findFirst({
          where: {
            stockId: entry.stockId,
            date: { gte: entry.date },
          },
          orderBy: { date: 'asc' },
        }),
        this.prisma.stockDaily.findFirst({
          where: {
            stockId: entry.stockId,
            date: { gte: entry.date },
          },
          orderBy: { high: 'desc' },
        }),
      ]);

      if (!entryBar || !peakBar) continue;

      const entryPrice = Number(entryBar.close);
      const peakPrice = Number(peakBar.high);
      const peakGain = ((peakPrice - entryPrice) / entryPrice) * 100;

      if (peakGain < minGain) continue;

      const entryDate = entryBar.date;
      const peakDate = peakBar.date;
      const duration = Math.round(
        (peakDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const themeName =
        entry.stock.themeStocks?.[0]?.group?.theme?.name ?? null;

      leaders.push({
        ticker: entry.stock.ticker,
        name: entry.stock.name,
        peakGain: Math.round(peakGain * 10) / 10,
        duration,
        theme: themeName,
        entryDate: entryDate.toISOString(),
        peakDate: peakDate.toISOString(),
        entryPrice,
        peakPrice,
        stage: entry.stage,
      });
    }

    // Sort by peak gain descending
    leaders.sort((a, b) => b.peakGain - a.peakGain);

    return leaders;
  }
}
