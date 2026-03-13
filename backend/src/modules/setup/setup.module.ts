import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupOrchestratorService } from './setup-orchestrator.service';
import { TimingSignalService } from './timing-signal.service';

@Module({
  controllers: [SetupController],
  providers: [SetupOrchestratorService, TimingSignalService],
  exports: [SetupOrchestratorService, TimingSignalService],
})
export class SetupModule {}
