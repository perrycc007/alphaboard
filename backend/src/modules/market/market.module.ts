import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { BreadthService } from './breadth.service';
import { MarketRegimeService } from './market-regime.service';
import { StockModule } from '../stock/stock.module';
import { SetupModule } from '../setup/setup.module';
import { IndicatorService } from '../data-ingestion/services/indicator.service';

@Module({
  imports: [StockModule, SetupModule],
  controllers: [MarketController],
  providers: [MarketService, BreadthService, MarketRegimeService, IndicatorService],
  exports: [MarketService, BreadthService, MarketRegimeService],
})
export class MarketModule {}
