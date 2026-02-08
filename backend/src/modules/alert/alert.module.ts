import { Module } from '@nestjs/common';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';
import { AlertGateway } from './alert.gateway';

@Module({
  controllers: [AlertController],
  providers: [AlertService, AlertGateway],
  exports: [AlertService, AlertGateway],
})
export class AlertModule {}
