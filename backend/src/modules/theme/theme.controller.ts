import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ThemeService } from './theme.service';

@Controller('api/themes')
@AllowAnonymous()
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get()
  findAll() {
    return this.themeService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.themeService.findById(id);
  }

  @Post()
  create(@Body() body: { name: string; description?: string }) {
    return this.themeService.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.themeService.update(id, body);
  }

  @Post(':id/stocks')
  addStock(
    @Param('id') id: string,
    @Body() body: { groupId: string; stockId: string },
  ) {
    return this.themeService.addStockToGroup(body.groupId, body.stockId);
  }
}
