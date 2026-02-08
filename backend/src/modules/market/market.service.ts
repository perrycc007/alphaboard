import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BreadthService } from './breadth.service';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly breadthService: BreadthService,
  ) {}

  async getOverview() {
    const [indices, latestBreadth] = await Promise.all([
      this.getIndicesWithLatest(),
      this.breadthService.getLatest(),
    ]);

    return {
      indices,
      breadth: latestBreadth,
      timestamp: new Date().toISOString(),
    };
  }

  async getIndicesWithLatest() {
    const indices = await this.prisma.indexEntity.findMany({
      include: {
        dailyBars: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return indices.map((idx) => ({
      ticker: idx.ticker,
      name: idx.name,
      latest: idx.dailyBars[0] ?? null,
    }));
  }

  async getIndexDaily(ticker: string, range?: string) {
    const index = await this.prisma.indexEntity.findUniqueOrThrow({
      where: { ticker },
    });

    const dateFilter = range ? this.buildDateFilter(range) : {};

    return this.prisma.indexDaily.findMany({
      where: { indexId: index.id, ...dateFilter },
      orderBy: { date: 'asc' },
    });
  }

  private buildDateFilter(range: string): { date?: { gte: Date } } {
    const days = parseInt(range.replace('d', ''), 10);
    if (isNaN(days)) return {};
    const since = new Date();
    since.setDate(since.getDate() - days);
    return { date: { gte: since } };
  }
}
