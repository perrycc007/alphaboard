import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BreadthService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatest() {
    return this.prisma.breadthSnapshot.findFirst({
      orderBy: { date: 'desc' },
    });
  }

  async getTimeSeries(range?: string) {
    const dateFilter = range ? this.buildDateFilter(range) : {};
    return this.prisma.breadthSnapshot.findMany({
      where: dateFilter,
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
