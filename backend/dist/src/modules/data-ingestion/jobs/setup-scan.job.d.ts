import { PrismaService } from '../../../prisma/prisma.service';
import { SetupOrchestratorService } from '../../setup/setup-orchestrator.service';
export declare class SetupScanJob {
    private readonly prisma;
    private readonly orchestrator;
    private readonly logger;
    constructor(prisma: PrismaService, orchestrator: SetupOrchestratorService);
    run(): Promise<void>;
    private getSetupCandidates;
}
