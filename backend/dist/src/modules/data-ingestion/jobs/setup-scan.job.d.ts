import { PrismaService } from '../../../prisma/prisma.service';
import { SetupOrchestratorService } from '../../setup/setup-orchestrator.service';
import { MarketRegimeService } from '../../market/market-regime.service';
export declare class SetupScanJob {
    private readonly prisma;
    private readonly orchestrator;
    private readonly marketRegimeService;
    private readonly logger;
    constructor(prisma: PrismaService, orchestrator: SetupOrchestratorService, marketRegimeService: MarketRegimeService);
    run(): Promise<void>;
    private getSetupCandidates;
}
