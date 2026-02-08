import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ThemeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const themes = await this.prisma.theme.findMany({
      where: { isActive: true },
      include: {
        groups: {
          include: {
            themeStocks: {
              include: {
                stock: {
                  include: {
                    stages: { orderBy: { date: 'desc' }, take: 1 },
                    setups: { where: { state: { in: ['BUILDING', 'READY', 'TRIGGERED'] } } },
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return themes.map((theme) => {
      const allStocks = theme.groups.flatMap((g) => g.themeStocks);
      const stages = allStocks
        .map((ts) => ts.stock.stages[0])
        .filter(Boolean);
      const setups = allStocks.flatMap((ts) => ts.stock.setups);

      const hotCount = stages.filter((s) => s.category === 'HOT').length;
      const formerHotCount = stages.filter(
        (s) => s.category === 'FORMER_HOT',
      ).length;
      const setupCount = setups.length;
      const bullishSetups = setups.filter(
        (s) => s.direction === 'LONG',
      ).length;
      const bearishSetups = setups.filter(
        (s) => s.direction === 'SHORT',
      ).length;

      const total = stages.length || 1;
      const stageDistribution = {
        stage1: stages.filter((s) => s.stage === 'STAGE_1').length / total,
        stage2: stages.filter((s) => s.stage === 'STAGE_2').length / total,
        stage3: stages.filter((s) => s.stage === 'STAGE_3').length / total,
        stage4: stages.filter((s) => s.stage === 'STAGE_4').length / total,
      };

      return {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        stats: {
          hotCount,
          formerHotCount,
          setupCount,
          bullishPct:
            setupCount > 0
              ? Math.round((bullishSetups / setupCount) * 100)
              : 0,
          bearishPct:
            setupCount > 0
              ? Math.round((bearishSetups / setupCount) * 100)
              : 0,
          stageDistribution,
        },
      };
    });
  }

  async findById(id: string) {
    const theme = await this.prisma.theme.findUnique({
      where: { id },
      include: {
        groups: {
          include: {
            themeStocks: {
              include: {
                stock: {
                  include: {
                    stages: { orderBy: { date: 'desc' }, take: 1 },
                    dailyBars: { orderBy: { date: 'desc' }, take: 1 },
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!theme) throw new NotFoundException(`Theme ${id} not found`);
    return theme;
  }

  async create(data: { name: string; description?: string }) {
    return this.prisma.theme.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    return this.prisma.theme.update({ where: { id }, data });
  }

  async addStockToGroup(groupId: string, stockId: string) {
    return this.prisma.themeStock.create({
      data: { groupId, stockId },
    });
  }
}
