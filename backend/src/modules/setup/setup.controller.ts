import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SetupOrchestratorService } from './setup-orchestrator.service';
import { SetupType, Timeframe } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { appendJsonLog, readJsonLog } from '../../common/utils/file-log.util';

type FeedbackRating =
  | 'CORRECT'
  | 'FALSE_POSITIVE'
  | 'EARLY'
  | 'LATE'
  | 'WRONG_TYPE'
  | 'MISSED';

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

  @Get('setups/:id/feedback')
  async getSetupFeedback(@Param('id') id: string) {
    const rows = await readJsonLog('setup-feedback.json');
    return rows
      .filter((row) => row.setupId === id)
      .sort((a, b) =>
        String(b.loggedAt ?? '').localeCompare(String(a.loggedAt ?? '')),
      );
  }

  @Post('setups/:id/feedback')
  async addSetupFeedback(
    @Param('id') id: string,
    @Body() body: { rating: FeedbackRating; comment?: string },
  ) {
    await appendJsonLog('setup-feedback.json', {
      setupId: id,
      rating: body.rating,
      comment: body.comment ?? null,
    });
    return { saved: true };
  }

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

  @Get('event-log')
  async getEventLog(
    @Query('source') source?: string,
    @Query('event') event?: string,
    @Query('ticker') ticker?: string,
    @Query('limit') limit?: string,
  ) {
    const max = Math.min(Number(limit) || 100, 500);
    const rows = await readJsonLog('detector-events.json');
    return rows
      .filter((row) => (source ? row.source === source : true))
      .filter((row) => (event ? row.event === event : true))
      .filter((row) => (ticker ? row.ticker === ticker : true))
      .sort((a, b) =>
        String(b.loggedAt ?? '').localeCompare(String(a.loggedAt ?? '')),
      )
      .slice(0, max);
  }
}
