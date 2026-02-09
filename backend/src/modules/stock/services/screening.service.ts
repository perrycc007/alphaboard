import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StageEnum, StockCategory } from '@prisma/client';

export interface ScreeningFilter {
  stage?: StageEnum;
  category?: StockCategory;
  isTemplate?: boolean;
  minRsRank?: number;
  sector?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ScreeningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Screen stocks by Stage 2 template or custom criteria.
   * Queries the latest StockStage row per stock.
   */
  async screen(filter: ScreeningFilter) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;

    const stages = await this.prisma.stockStage.findMany({
      where: {
        ...(filter.stage && { stage: filter.stage }),
        ...(filter.category && { category: filter.category }),
        ...(filter.isTemplate !== undefined && {
          isTemplate: filter.isTemplate,
        }),
      },
      orderBy: { date: 'desc' },
      distinct: ['stockId'],
      include: {
        stock: {
          include: {
            dailyBars: {
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    let results = stages.map((s) => ({
      stock: s.stock,
      stage: s.stage,
      category: s.category,
      isTemplate: s.isTemplate,
      latestBar: s.stock.dailyBars[0] ?? null,
    }));

    if (filter.minRsRank !== undefined) {
      results = results.filter((r) => {
        const rs = r.latestBar?.rsRank;
        return rs != null && Number(rs) >= filter.minRsRank!;
      });
    }

    if (filter.sector) {
      results = results.filter((r) => r.stock.sector === filter.sector);
    }

    const total = results.length;
    const skip = (page - 1) * limit;
    const items = results.slice(skip, skip + limit);

    return { items, total, page, limit };
  }
}
