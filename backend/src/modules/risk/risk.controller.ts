import { Controller, Post, Body } from '@nestjs/common';
import { RiskEngineService } from './risk-engine.service';

@Controller('api/risk')
export class RiskController {
  constructor(private readonly riskEngine: RiskEngineService) {}

  @Post('calculate')
  calculate(
    @Body()
    body: {
      accountEquity: number;
      riskPercent: number;
      entryPrice: number;
      stopPrice: number;
    },
  ) {
    return this.riskEngine.calculate(
      body.accountEquity,
      body.riskPercent,
      body.entryPrice,
      body.stopPrice,
    );
  }

  @Post('stop-levels')
  stopLevels(@Body() body: { setupLow: number; atr14: number }) {
    return this.riskEngine.stopLevels(body.setupLow, body.atr14);
  }
}
