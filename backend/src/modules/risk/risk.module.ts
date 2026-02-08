import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskEngineService } from './risk-engine.service';

@Module({
  controllers: [RiskController],
  providers: [RiskEngineService],
  exports: [RiskEngineService],
})
export class RiskModule {}
