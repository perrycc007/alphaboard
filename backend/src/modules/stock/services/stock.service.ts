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
}
