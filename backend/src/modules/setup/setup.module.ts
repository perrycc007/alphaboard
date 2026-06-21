import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupOrchestratorService } from './setup-orchestrator.service';
import { TimingSignalService } from './timing-signal.service';
import { KeyLevelCandidateService } from './candidates/key-level-candidate.service';
import { LooseSetupCandidateService } from './candidates/loose-setup-candidate.service';
import { Reversal620ReadinessService } from './candidates/reversal-620-readiness.service';
import { PythonSignalDetectorService } from './python-signal-detector.service';
import { SetupAuditService } from './setup-audit.service';

@Module({
  controllers: [SetupController],
  providers: [
    SetupOrchestratorService,
    TimingSignalService,
    KeyLevelCandidateService,
    LooseSetupCandidateService,
    Reversal620ReadinessService,
    PythonSignalDetectorService,
    SetupAuditService,
  ],
  exports: [
    SetupOrchestratorService,
    TimingSignalService,
    KeyLevelCandidateService,
    LooseSetupCandidateService,
    Reversal620ReadinessService,
    PythonSignalDetectorService,
    SetupAuditService,
  ],
})
export class SetupModule {}
