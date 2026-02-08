import { Controller, Get, Param, Query } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { MarketService } from './market.service';
import { BreadthService } from './breadth.service';

@Controller('api/market')
@AllowAnonymous()
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly breadthService: BreadthService,
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
}
