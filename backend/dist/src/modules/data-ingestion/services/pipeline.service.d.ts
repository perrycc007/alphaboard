import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TickerDiscoveryService } from './ticker-discovery.service';
import { BackfillService } from './backfill.service';
import { IndicatorService } from './indicator.service';
import { RsRankService } from './rs-rank.service';
import { StageRecalcJob } from '../jobs/stage-recalc.job';
import { SetupScanJob } from '../jobs/setup-scan.job';
import { BreadthSyncJob } from '../jobs/breadth-sync.job';
export interface PipelineResult {
    synced: number;
    failed: number;
    indicatorsUpdated: number;
    rsRanked: number;
    completedAt: Date;
    durationMs: number;
}
export interface PipelineStatus {
    running: boolean;
    lastResult: PipelineResult | null;
    stockCount: number;
    lastSyncDate: Date | null;
}
export declare class PipelineService implements OnModuleInit {
    private readonly prisma;
    private readonly tickerDiscovery;
    private readonly backfillService;
    private readonly indicatorService;
    private readonly rsRankService;
    private readonly stageRecalcJob;
    private readonly setupScanJob;
    private readonly breadthSyncJob;
    private readonly logger;
    private running;
    private lastResult;
    constructor(prisma: PrismaService, tickerDiscovery: TickerDiscoveryService, backfillService: BackfillService, indicatorService: IndicatorService, rsRankService: RsRankService, stageRecalcJob: StageRecalcJob, setupScanJob: SetupScanJob, breadthSyncJob: BreadthSyncJob);
    onModuleInit(): Promise<void>;
    checkAndSync(): Promise<void>;
    runFullPipeline(): Promise<PipelineResult>;
    getStatus(): Promise<PipelineStatus>;
    isRunning(): boolean;
}
