import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TickerDiscoveryService } from './ticker-discovery.service';
import { BackfillService } from './backfill.service';
import { IndicatorService } from './indicator.service';
import { RsRankService } from './rs-rank.service';
import { StageRecalcJob } from '../jobs/stage-recalc.job';
import { SetupScanJob } from '../jobs/setup-scan.job';
import { BreadthSyncJob } from '../jobs/breadth-sync.job';
import { MarketRegimeService } from '../../market/market-regime.service';
import {
  PIPELINE_STEP_IDS,
  PipelineStepId,
  PipelineStepStatus,
  selectPipelineSteps,
} from './pipeline-steps';

export interface PipelineResult {
  synced: number;
  failed: number;
  indicatorsUpdated: number;
  rsRanked: number;
  completedAt: Date;
  durationMs: number;
}

export interface PipelineRunOptions {
  /** Skip Yahoo daily + index backfill (use when bars are already fresh). */
  skipBackfill?: boolean;
  fromStep?: string;
  toStep?: string;
  scanRunId?: string;
  onStepTiming?: (
    stepId: PipelineStepId,
    status: PipelineStepStatus,
    durationMs: number,
    reason?: string,
  ) => void;
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

  private isPipelineEnabled(): boolean {
    const raw = process.env.ENABLE_PIPELINE_SYNC;
    if (!raw) return false;
    return raw.toLowerCase() === 'true';
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly tickerDiscovery: TickerDiscoveryService,
    private readonly backfillService: BackfillService,
    private readonly indicatorService: IndicatorService,
    private readonly rsRankService: RsRankService,
    private readonly stageRecalcJob: StageRecalcJob,
    private readonly setupScanJob: SetupScanJob,
    private readonly breadthSyncJob: BreadthSyncJob,
    private readonly marketRegimeService: MarketRegimeService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isPipelineEnabled()) {
      this.logger.log(
        'Pipeline startup sync disabled (ENABLE_PIPELINE_SYNC != true)',
      );
      return;
    }
    // Non-blocking: run in background so the app starts immediately
    this.checkAndSync().catch((err) =>
      this.logger.error('Startup sync failed', err),
    );
  }

  /**
   * Check if data is stale and run the full pipeline if needed.
   */
  async checkAndSync(): Promise<void> {
    if (!this.isPipelineEnabled()) {
      this.logger.log('Pipeline check skipped (ENABLE_PIPELINE_SYNC != true)');
      return;
    }

    const tasks = await this.backfillService.getStocksNeedingSync();
    if (tasks.length === 0) {
      this.logger.log('All data up to date -- skipping pipeline');
      return;
    }
    this.logger.log(`${tasks.length} stocks need syncing -- running pipeline`);
    await this.runFullPipeline();
  }

  private shouldSkipBackfill(options?: PipelineRunOptions): boolean {
    if (options?.skipBackfill) return true;
    const raw = process.env.PIPELINE_SKIP_BACKFILL;
    return raw != null && raw.toLowerCase() === 'true';
  }

  private recordStep(
    options: PipelineRunOptions | undefined,
    stepId: PipelineStepId,
    status: PipelineStepStatus,
    durationMs: number,
    reason?: string,
  ): void {
    options?.onStepTiming?.(stepId, status, durationMs, reason);
  }

  private logMemory(label: string): void {
    const usage = process.memoryUsage();
    this.logger.log(
      `${label} memory rss=${Math.round(usage.rss / 1024 / 1024)}MB heapUsed=${Math.round(usage.heapUsed / 1024 / 1024)}MB heapTotal=${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    );
  }

  private async runSelectedStep<T>(
    options: PipelineRunOptions | undefined,
    selected: Set<PipelineStepId>,
    stepId: PipelineStepId,
    label: string,
    work: () => Promise<T>,
  ): Promise<T | undefined> {
    if (!selected.has(stepId)) {
      this.logger.log(`Step ${stepId}: Skipped (outside selected range)`);
      this.recordStep(options, stepId, 'skipped', 0, 'outside selected range');
      return undefined;
    }

    this.logger.log(`Step ${stepId}: ${label}...`);
    const startedAt = Date.now();
    const result = await work();
    this.recordStep(options, stepId, 'ran', Date.now() - startedAt);
    return result;
  }

  /**
   * Execute the full data pipeline in sequence.
   */
  async runFullPipeline(options?: PipelineRunOptions): Promise<PipelineResult> {
    if (this.running) {
      throw new Error('Pipeline is already running');
    }

    const selectedSteps = new Set(
      selectPipelineSteps(options?.fromStep, options?.toStep, PIPELINE_STEP_IDS),
    );
    this.running = true;
    const startTime = Date.now();

    try {
      this.logger.log('=== PIPELINE START ===');

      // 1. Discover new tickers if stock table is sparse
      if (!selectedSteps.has('1')) {
        this.logger.log('Step 1: Skipped (outside selected range)');
        this.recordStep(options, '1', 'skipped', 0, 'outside selected range');
      } else {
        const stepStartedAt = Date.now();
        const stockCount = await this.prisma.stock.count();
        if (stockCount < 1000) {
          this.logger.log('Step 1: Discovering tickers...');
          await this.tickerDiscovery.discoverTickers();
          this.recordStep(options, '1', 'ran', Date.now() - stepStartedAt);
        } else {
          this.logger.log(`Step 1: Skipped (${stockCount} stocks already in DB)`);
          this.recordStep(
            options,
            '1',
            'skipped',
            Date.now() - stepStartedAt,
            `${stockCount} stocks already in DB`,
          );
        }
      }

      let synced = 0;
      let failed = 0;
      const skipBackfill = this.shouldSkipBackfill(options);
      if (skipBackfill && selectedSteps.has('2')) {
        this.logger.log('Step 2: Skipped (PIPELINE_SKIP_BACKFILL=true)');
        this.recordStep(options, '2', 'skipped', 0, 'backfill skipped');
      } else if (skipBackfill) {
        this.logger.log('Step 2: Skipped (outside selected range)');
        this.recordStep(options, '2', 'skipped', 0, 'outside selected range');
      } else {
        await this.runSelectedStep(
          options,
          selectedSteps,
          '2',
          'Backfilling daily bars',
          async () => {
            ({ synced, failed } = await this.backfillService.backfillAll());
          },
        );
      }

      if (skipBackfill && selectedSteps.has('3')) {
        this.logger.log('Step 3: Skipped (PIPELINE_SKIP_BACKFILL=true)');
        this.recordStep(options, '3', 'skipped', 0, 'backfill skipped');
      } else if (skipBackfill) {
        this.logger.log('Step 3: Skipped (outside selected range)');
        this.recordStep(options, '3', 'skipped', 0, 'outside selected range');
      } else {
        await this.runSelectedStep(
          options,
          selectedSteps,
          '3',
          'Backfilling index bars',
          () => this.backfillService.backfillIndices(),
        );
      }

      // 4. Compute indicators for all stocks with new bars
      const indicatorResult = await this.runSelectedStep(
        options,
        selectedSteps,
        '4',
        'Computing indicators',
        () => this.indicatorService.computeAllStocks(),
      );
      const indicatorsUpdated = indicatorResult?.updated ?? 0;

      // 5. Compute RS Rank (needs all indicators + full universe)
      const rsRanked =
        (await this.runSelectedStep(options, selectedSteps, '5', 'Computing RS Ranks', () =>
          this.rsRankService.computeRanks(),
        )) ?? 0;

      // 6. Classify stages for all stocks
      await this.runSelectedStep(options, selectedSteps, '6', 'Classifying stages', () =>
        this.stageRecalcJob.run(),
      );

      // 7. Detect setups (filtered stocks only)
      await this.runSelectedStep(options, selectedSteps, '7', 'Detecting setups', async () => {
        this.logMemory('Before Step 7');
        await this.setupScanJob.run(options?.scanRunId);
        this.logMemory('After Step 7');
      });

      // 8. Compute breadth from universe
      await this.runSelectedStep(options, selectedSteps, '8', 'Computing breadth', () =>
        this.breadthSyncJob.run(),
      );

      // 9. Rebuild market context artifacts
      await this.runSelectedStep(options, selectedSteps, '9a', 'Rebuilding proxy snapshots', () =>
        this.marketRegimeService.rebuildPipelineStep('9a'),
      );
      await this.runSelectedStep(options, selectedSteps, '9b', 'Rebuilding leader runs', () =>
        this.marketRegimeService.rebuildPipelineStep('9b'),
      );
      await this.runSelectedStep(options, selectedSteps, '9c', 'Rebuilding setup outcomes', () =>
        this.marketRegimeService.rebuildPipelineStep('9c'),
      );
      await this.runSelectedStep(options, selectedSteps, '9d', 'Rebuilding regime periods', () =>
        this.marketRegimeService.rebuildPipelineStep('9d'),
      );

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
