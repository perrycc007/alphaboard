import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { AlertService } from './alert.service';
import { AlertType } from '@prisma/client';

@Controller('api/alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.alertService.findByUser(userId);
  }

  @Post()
  create(
    @Body()
    body: {
      userId: string;
      stockId?: string;
      type: AlertType;
      condition: Record<string, unknown>;
    },
  ) {
    return this.alertService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.alertService.remove(id);
  }
}
