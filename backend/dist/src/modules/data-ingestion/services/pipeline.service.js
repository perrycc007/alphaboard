"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const ticker_discovery_service_1 = require("./ticker-discovery.service");
const backfill_service_1 = require("./backfill.service");
const indicator_service_1 = require("./indicator.service");
const rs_rank_service_1 = require("./rs-rank.service");
const stage_recalc_job_1 = require("../jobs/stage-recalc.job");
const setup_scan_job_1 = require("../jobs/setup-scan.job");
const breadth_sync_job_1 = require("../jobs/breadth-sync.job");
let PipelineService = PipelineService_1 = class PipelineService {
    prisma;
    tickerDiscovery;
    backfillService;
    indicatorService;
    rsRankService;
    stageRecalcJob;
    setupScanJob;
    breadthSyncJob;
    logger = new common_1.Logger(PipelineService_1.name);
    running = false;
    lastResult = null;
    constructor(prisma, tickerDiscovery, backfillService, indicatorService, rsRankService, stageRecalcJob, setupScanJob, breadthSyncJob) {
        this.prisma = prisma;
        this.tickerDiscovery = tickerDiscovery;
        this.backfillService = backfillService;
        this.indicatorService = indicatorService;
        this.rsRankService = rsRankService;
        this.stageRecalcJob = stageRecalcJob;
        this.setupScanJob = setupScanJob;
        this.breadthSyncJob = breadthSyncJob;
    }
    async onModuleInit() {
        this.checkAndSync().catch((err) => this.logger.error('Startup sync failed', err));
    }
    async checkAndSync() {
        const tasks = await this.backfillService.getStocksNeedingSync();
        if (tasks.length === 0) {
            this.logger.log('All data up to date -- skipping pipeline');
            return;
        }
        this.logger.log(`${tasks.length} stocks need syncing -- running pipeline`);
        await this.runFullPipeline();
    }
    async runFullPipeline() {
        if (this.running) {
            throw new Error('Pipeline is already running');
        }
        this.running = true;
        const startTime = Date.now();
        try {
            this.logger.log('=== PIPELINE START ===');
            const stockCount = await this.prisma.stock.count();
            if (stockCount < 1000) {
                this.logger.log('Step 1: Discovering tickers...');
                await this.tickerDiscovery.discoverTickers();
            }
            else {
                this.logger.log(`Step 1: Skipped (${stockCount} stocks already in DB)`);
            }
            this.logger.log('Step 2: Backfilling daily bars...');
            const { synced, failed } = await this.backfillService.backfillAll();
            this.logger.log('Step 3: Backfilling index bars...');
            await this.backfillService.backfillIndices();
            this.logger.log('Step 4: Computing indicators...');
            const { updated: indicatorsUpdated } = await this.indicatorService.computeAllStocks();
            this.logger.log('Step 5: Computing RS Ranks...');
            const rsRanked = await this.rsRankService.computeRanks();
            this.logger.log('Step 6: Classifying stages...');
            await this.stageRecalcJob.run();
            this.logger.log('Step 7: Detecting setups...');
            await this.setupScanJob.run();
            this.logger.log('Step 8: Computing breadth...');
            await this.breadthSyncJob.run();
            const durationMs = Date.now() - startTime;
            this.lastResult = {
                synced,
                failed,
                indicatorsUpdated,
                rsRanked,
                completedAt: new Date(),
                durationMs,
            };
            this.logger.log(`=== PIPELINE COMPLETE === (${Math.round(durationMs / 1000)}s, ${synced} synced, ${failed} failed)`);
            return this.lastResult;
        }
        finally {
            this.running = false;
        }
    }
    async getStatus() {
        const stockCount = await this.prisma.stock.count({ where: { isActive: true } });
        const latestSync = await this.prisma.stock.findFirst({
            where: { lastSyncDate: { not: null } },
            orderBy: { lastSyncDate: 'desc' },
            select: { lastSyncDate: true },
        });
        return {
            running: this.running,
            lastResult: this.lastResult,
            stockCount,
            lastSyncDate: latestSync?.lastSyncDate ?? null,
        };
    }
    isRunning() {
        return this.running;
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = PipelineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ticker_discovery_service_1.TickerDiscoveryService,
        backfill_service_1.BackfillService,
        indicator_service_1.IndicatorService,
        rs_rank_service_1.RsRankService,
        stage_recalc_job_1.StageRecalcJob,
        setup_scan_job_1.SetupScanJob,
        breadth_sync_job_1.BreadthSyncJob])
], PipelineService);
//# sourceMappingURL=pipeline.service.js.map