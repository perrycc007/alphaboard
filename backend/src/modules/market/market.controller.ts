import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { MarketService } from './market.service';
import { BreadthService } from './breadth.service';
import { MarketRegimeService } from './market-regime.service';
import { MarketPeriodGranularity } from '@prisma/client';

@Controller('api/market')
@AllowAnonymous()
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly breadthService: BreadthService,
    private readonly marketRegimeService: MarketRegimeService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.marketService.getOverview();
  }

  @Get('breadth')
  getBreadthTimeSeries(@Query('range') range?: string) {
    return this.breadthService.getTimeSeries(range);
  }

  @Get('indices/:ticker/daily')
  getIndexDaily(
    @Param('ticker') ticker: string,
    @Query('range') range?: string,
  ) {
    return this.marketService.getIndexDaily(ticker, range);
  }

  @Get('regimes')
  getRegimes(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity: MarketPeriodGranularity = MarketPeriodGranularity.REGIME,
  ) {
    return this.marketRegimeService.listPeriods(from, to, granularity);
  }

  @Get('regimes/report')
  async getRegimeReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format = 'json',
    @Query('granularity') granularity: MarketPeriodGranularity = MarketPeriodGranularity.REGIME,
  ) {
    if (format === 'markdown') {
      return {
        format: 'markdown',
        content: await this.marketRegimeService.renderReport(from, to, granularity),
      };
    }
    return this.marketRegimeService.listPeriods(from, to, granularity);
  }

  @Get('regimes/leader/:ticker')
  getLeaderTimeline(
    @Param('ticker') ticker: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity: MarketPeriodGranularity = MarketPeriodGranularity.MONTH,
  ) {
    return this.marketRegimeService.getLeaderTimeline(ticker, from, to, granularity);
  }

  @Get('regimes/:id')
  getRegimeById(@Param('id') id: string) {
    return this.marketRegimeService.getPeriod(id);
  }

  @Post('regimes/rebuild')
  rebuildRegimes() {
    return this.marketRegimeService.rebuildAll();
  }
}
