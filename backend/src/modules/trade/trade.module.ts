import { Module } from '@nestjs/common';
import { TradeController } from './trade.controller';
import { TradeLifecycleService } from './trade-lifecycle.service';

@Module({
  controllers: [TradeController],
  providers: [TradeLifecycleService],
  exports: [TradeLifecycleService],
})
export class TradeModule {}
