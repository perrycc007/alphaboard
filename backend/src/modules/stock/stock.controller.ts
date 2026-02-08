import { Controller, Get, Param, Query } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { StockService } from './services/stock.service';
import { ScreeningService, ScreeningFilter } from './services/screening.service';
import { StageEnum, StockCategory } from '@prisma/client';

@Controller('api/stocks')
@AllowAnonymous()
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly screeningService: ScreeningService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.stockService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Get('screen')
  screen(
    @Query('stage') stage?: StageEnum,
    @Query('category') category?: StockCategory,
    @Query('isTemplate') isTemplate?: string,
    @Query('minRsRank') minRsRank?: string,
    @Query('sector') sector?: string,
  ) {
    const filter: ScreeningFilter = {
      stage,
      category,
      isTemplate: isTemplate !== undefined ? isTemplate === 'true' : undefined,
      minRsRank: minRsRank ? parseFloat(minRsRank) : undefined,
      sector,
    };
    return this.screeningService.screen(filter);
  }

  @Get(':ticker')
  findByTicker(@Param('ticker') ticker: string) {
    return this.stockService.findByTicker(ticker);
  }

  @Get(':ticker/daily')
  getDailyBars(
    @Param('ticker') ticker: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockService.getDailyBars(
      ticker,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':ticker/intraday')
  getIntradayBars(@Param('ticker') ticker: string) {
    return this.stockService.getIntradayBars(ticker);
  }

  @Get(':ticker/stage-history')
  getStageHistory(@Param('ticker') ticker: string) {
    return this.stockService.getStageHistory(ticker);
  }
}
