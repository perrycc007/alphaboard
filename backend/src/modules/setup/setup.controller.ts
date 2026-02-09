import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SetupOrchestratorService } from './setup-orchestrator.service';
import { SetupType, Timeframe } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api')
@AllowAnonymous()
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

  @Post('setups/scan')
  async triggerScan() {
    return { message: 'Scan triggered' };
  }

  @Get('setups/simulate/:ticker')
  async simulateSetups(
    @Param('ticker') ticker: string,
    @Query('from') from?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date('2008-01-01');
    return this.orchestrator.simulateDetection(ticker, fromDate);
  }

  @Get('setups/:id')
  getSetupById(@Param('id') id: string) {
    return this.orchestrator.getSetupById(id);
  }

  @Get('setups/:id/evidence')
  getSetupEvidence(@Param('id') id: string) {
    return this.prisma.barEvidence.findMany({
      where: { setupId: id },
      orderBy: { barDate: 'desc' },
    });
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
}
