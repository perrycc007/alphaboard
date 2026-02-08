import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { TradeLifecycleService } from './trade-lifecycle.service';
import { Direction, Bias } from '@prisma/client';

@Controller('api/trades')
@AllowAnonymous()
export class TradeController {
  constructor(private readonly tradeService: TradeLifecycleService) {}

  @Post('ideas')
  createIdea(
    @Body()
    body: {
      userId?: string;
      setupId?: string;
      stockId: string;
      direction: Direction;
      bias: Bias;
      entryPrice?: number;
      stopPrice: number;
      targetPrice?: number;
      riskPercent: number;
      notes?: string;
    },
  ) {
    return this.tradeService.createIdea(body);
  }

  @Get('ideas')
  listIdeas() {
    return this.tradeService.listIdeas();
  }

  @Post('ideas/:id/confirm')
  confirmIdea(@Param('id') id: string) {
    return this.tradeService.confirmIdea(id);
  }

  @Post('ideas/:id/skip')
  skipIdea(@Param('id') id: string) {
    return this.tradeService.skipIdea(id);
  }

  @Post('intents/:id/order')
  placeOrder(
    @Param('id') intentId: string,
    @Body()
    body: {
      type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
      side: Direction;
      quantity: number;
      limitPrice?: number;
      stopPrice?: number;
    },
  ) {
    return this.tradeService.placeOrder(intentId, body);
  }

  @Get('positions')
  listPositions() {
    return this.tradeService.listPositions();
  }

  @Put('positions/:id/stop')
  updateStop(
    @Param('id') id: string,
    @Body() body: { stopPrice: number },
  ) {
    return this.tradeService.updateStop(id, body.stopPrice);
  }

  @Post('positions/:id/close')
  closePosition(@Param('id') id: string) {
    return this.tradeService.closePosition(id);
  }
}
