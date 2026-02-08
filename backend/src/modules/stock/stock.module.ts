import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from './services/stock.service';
import { ScreeningService } from './services/screening.service';
import { StageClassifierService } from './services/stage-classifier.service';

@Module({
  controllers: [StockController],
  providers: [StockService, ScreeningService, StageClassifierService],
  exports: [StockService, ScreeningService, StageClassifierService],
})
export class StockModule {}
