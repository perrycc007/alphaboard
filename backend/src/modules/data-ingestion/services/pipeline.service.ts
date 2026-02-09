import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

/**
 * Full pipeline orchestrator. Runs the entire data pipeline in sequence:
 * 1. Discover tickers (if stock table sparse)
 * 2. Backfill daily bars via Yahoo Finance
 * 3. Backfill index daily bars
 * 4. Compute indicators (SMA/EMA/ATR)
 * 5. Compute RS Rank
 * 6. Classify stages
 * 7. Detect setups (filtered)
 * 8. Compute breadth
 *
 * Implements OnModuleInit to trigger on app startup (non-blocking).
 */
@Injectable()
export class PipelineService implements OnModuleInit {
  private readonly logger = new Logger(PipelineService.name);
  private running = false;
  private lastResult: PipelineResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tickerDiscovery: TickerDiscoveryService,
    private readonly backfillService: BackfillService,
    private readonly indicatorService: IndicatorService,
    private readonly rsRankService: RsRankService,
    private readonly stageRecalcJob: StageRecalcJob,
    private readonly setupScanJob: SetupScanJob,
    private readonly breadthSyncJob: BreadthSyncJob,
  ) {}

  async onModuleInit(): Promise<void> {
    // Non-blocking: run in background so the app starts immediately
    this.checkAndSync().catch((err) =>
      this.logger.error('Startup sync failed', err),
    );
  }

  /**
   * Check if data is stale and run the full pipeline if needed.
   */
  async checkAndSync(): Promise<void> {
    const tasks = await this.backfillService.getStocksNeedingSync();
    if (tasks.length === 0) {
      this.logger.log('All data up to date -- skipping pipeline');
      return;
    }
    this.logger.log(`${tasks.length} stocks need syncing -- running pipeline`);
    await this.runFullPipeline();
  }

  /**
   * Execute the full data pipeline in sequence.
   */
  async runFullPipeline(): Promise<PipelineResult> {
    if (this.running) {
      throw new Error('Pipeline is already running');
    }

    this.running = true;
    const startTime = Date.now();

    try {
      this.logger.log('=== PIPELINE START ===');

      // 1. Discover new tickers if stock table is sparse
      const stockCount = await this.prisma.stock.count();
      if (stockCount < 1000) {
        this.logger.log('Step 1: Discovering tickers...');
        await this.tickerDiscovery.discoverTickers();
      } else {
        this.logger.log(`Step 1: Skipped (${stockCount} stocks already in DB)`);
      }

      // 2. Backfill missing daily bars via Yahoo Finance
      this.logger.log('Step 2: Backfilling daily bars...');
      const { synced, failed } = await this.backfillService.backfillAll();

      // 3. Backfill index daily bars (SPY, QQQ, DIA, IWM)
      this.logger.log('Step 3: Backfilling index bars...');
      await this.backfillService.backfillIndices();

      // 4. Compute indicators for all stocks with new bars
      this.logger.log('Step 4: Computing indicators...');
      const { updated: indicatorsUpdated } =
        await this.indicatorService.computeAllStocks();

      // 5. Compute RS Rank (needs all indicators + full universe)
      this.logger.log('Step 5: Computing RS Ranks...');
      const rsRanked = await this.rsRankService.computeRanks();

      // 6. Classify stages for all stocks
      this.logger.log('Step 6: Classifying stages...');
      await this.stageRecalcJob.run();

      // 7. Detect setups (filtered stocks only)
      this.logger.log('Step 7: Detecting setups...');
      await this.setupScanJob.run();

      // 8. Compute breadth from universe
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

      this.logger.log(
        `=== PIPELINE COMPLETE === (${Math.round(durationMs / 1000)}s, ${synced} synced, ${failed} failed)`,
      );

      return this.lastResult;
    } finally {
      this.running = false;
    }
  }

  /**
   * Return the current pipeline status.
   */
  async getStatus(): Promise<PipelineStatus> {
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

  isRunning(): boolean {
    return this.running;
  }
}
