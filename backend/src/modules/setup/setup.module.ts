import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupOrchestratorService } from './setup-orchestrator.service';

@Module({
  controllers: [SetupController],
  providers: [SetupOrchestratorService],
  exports: [SetupOrchestratorService],
})
export class SetupModule {}
