import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';

@Controller('api/watchlists')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.watchlistService.findByUser(userId);
  }

  @Post()
  create(@Body() body: { userId: string; name: string }) {
    return this.watchlistService.create(body.userId, body.name);
  }

  @Post(':id/stocks')
  addStock(
    @Param('id') watchlistId: string,
    @Body() body: { stockId: string },
  ) {
    return this.watchlistService.addStock(watchlistId, body.stockId);
  }

  @Delete(':id/stocks/:stockId')
  removeStock(
    @Param('id') watchlistId: string,
    @Param('stockId') stockId: string,
  ) {
    return this.watchlistService.removeStock(watchlistId, stockId);
  }
}
