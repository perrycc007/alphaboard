import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { SetupOrchestratorService } from './setup-orchestrator.service';
import { SetupType, Timeframe } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api')
export class SetupController {
  constructor(
    private readonly orchestrator: SetupOrchestratorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('setups')
  getActiveSetups(
    @Query('type') type?: SetupType,
    @Query('direction') direction?: string,
    @Query('timeframe') timeframe?: Timeframe,
  ) {
    return this.orchestrator.getActiveSetups({ type, direction, timeframe });
  }

  @Get('setups/:id')
  getSetupById(@Param('id') id: string) {
    return this.orchestrator.getSetupById(id);
  }

  @Post('setups/scan')
  async triggerScan() {
    // Admin/cron endpoint to trigger a manual scan
    // In practice, this would iterate over all active stocks
    return { message: 'Scan triggered' };
  }

  // Evidence endpoints
  @Get('stocks/:ticker/evidence')
  async getStockEvidence(
    @Param('ticker') ticker: string,
    @Query('timeframe') timeframe?: Timeframe,
  ) {
    const stock = await this.prisma.stock.findUniqueOrThrow({
      where: { ticker: ticker.toUpperCase() },
    });
    return this.prisma.barEvidence.findMany({
      where: {
        stockId: stock.id,
        ...(timeframe && { timeframe }),
      },
      orderBy: { barDate: 'desc' },
      take: 100,
    });
  }

  @Get('setups/:id/evidence')
  getSetupEvidence(@Param('id') id: string) {
    return this.prisma.barEvidence.findMany({
      where: { setupId: id },
      orderBy: { barDate: 'desc' },
    });
  }
}
