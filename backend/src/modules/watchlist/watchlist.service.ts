import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: {
        items: { include: { stock: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, name: string) {
    return this.prisma.watchlist.create({
      data: { userId, name },
    });
  }

  async addStock(watchlistId: string, stockId: string) {
    return this.prisma.watchlistItem.create({
      data: { watchlistId, stockId },
    });
  }

  async removeStock(watchlistId: string, stockId: string) {
    return this.prisma.watchlistItem.deleteMany({
      where: { watchlistId, stockId },
    });
  }
}
