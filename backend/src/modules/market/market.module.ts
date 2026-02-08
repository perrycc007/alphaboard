import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { BreadthService } from './breadth.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, BreadthService],
  exports: [MarketService, BreadthService],
})
export class MarketModule {}
