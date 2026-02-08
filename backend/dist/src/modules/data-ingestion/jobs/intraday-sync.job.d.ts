import { PrismaService } from '../../../prisma/prisma.service';
import { PolygonProvider } from '../providers/polygon.provider';
import { SetupOrchestratorService } from '../../setup/setup-orchestrator.service';
import { AlertGateway } from '../../alert/alert.gateway';
export declare class IntradaySyncJob {
    private readonly prisma;
    private readonly polygon;
    private readonly orchestrator;
    private readonly alertGateway;
    private readonly logger;
    constructor(prisma: PrismaService, polygon: PolygonProvider, orchestrator: SetupOrchestratorService, alertGateway: AlertGateway);
    run(): Promise<void>;
}
