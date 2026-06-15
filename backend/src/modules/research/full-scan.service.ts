import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PipelineResult,
  PipelineRunOptions,
  PipelineService,
} from '../data-ingestion/services/pipeline.service';
import {
  FULL_SCAN_STEP_IDS,
  PIPELINE_STEP_IDS,
  PipelineStepId,
  selectPipelineSteps,
} from '../data-ingestion/services/pipeline-steps';
import { MarketConditionService } from './market-condition.service';
import { ScanRunService, ScanRunContext } from './scan-run.service';
import { StrategyReportService } from './strategy-report.service';
import { MetadataEnrichmentService } from './metadata-enrichment.service';
import { CatalystService } from './catalyst.service';

/**
 * Coordinates a twice-weekly full scan. Wraps the existing data pipeline in a
 * measured `ScanRun` so timing and counts are recorded for later tuning.
 *
 * This intentionally delegates the heavy lifting to `PipelineService` rather
 * than duplicating ingestion/indicator/setup logic.
 */
@Injectable()
export class FullScanService {
  private readonly logger = new Logger(FullScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineService: PipelineService,
    private readonly scanRunService: ScanRunService,
    private readonly marketConditionService: MarketConditionService,
    private readonly strategyReportService: StrategyReportService,
    private readonly metadataService: MetadataEnrichmentService,
    private readonly catalystService: CatalystService,
  ) {}

  private intFromEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    const parsed = raw != null ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  isRunning(): boolean {
    return this.pipelineService.isRunning();
  }

  /**
   * Run the full pipeline under a tracked FULL_SCAN scan run, then compute the
   * market condition and derive a weekly focus list from the fresh universe.
   */
  async run(options?: PipelineRunOptions): Promise<PipelineResult> {
    const selectedSteps = selectPipelineSteps(
      options?.fromStep,
      options?.toStep,
      FULL_SCAN_STEP_IDS,
    );
    const selectedStepSet = new Set(selectedSteps);

    return this.scanRunService.run('FULL_SCAN', async (ctx) => {
      const result = await this.runPipelineSteps(ctx, selectedSteps, options);

      if (selectedStepSet.has('10')) {
        await ctx.step('10', () => this.marketConditionService.rebuild());
      } else {
        ctx.recordStep('10', 'skipped', 0, 'outside selected range');
      }

      let focusListId: string | null = null;
      if (selectedStepSet.has('11')) {
        const focusList = await ctx.step('11', () =>
          this.strategyReportService.buildWeeklyFocusList({
            sourceScanRunId: ctx.scanRunId,
          }),
        );
        focusListId = focusList.id;
      } else {
        ctx.recordStep('11', 'skipped', 0, 'outside selected range');
      }

      let model = { enriched: 0, catalysts: 0 };
      if (selectedStepSet.has('12')) {
        focusListId ??= await this.getLatestFocusListId();
        if (!focusListId) {
          throw new Error('Cannot run step 12 without an existing focus list');
        }
        const modelFocusListId = focusListId;
        model = await ctx.step('12', () =>
          this.runModelReview(ctx, modelFocusListId),
        );
      } else {
        ctx.recordStep('12', 'skipped', 0, 'outside selected range');
      }

      const stockCount = await this.prisma.stock.count({
        where: { isActive: true },
      });
      const focusListCount = focusListId
        ? await this.prisma.focusListItem.count({
            where: { focusListId },
          })
        : 0;
      ctx.setCounts({ stockCount, focusListCount });
      ctx.note(
        `synced=${result.synced} failed=${result.failed} indicators=${result.indicatorsUpdated} ` +
          `rsRanked=${result.rsRanked} focus=${focusListCount} ` +
          `enriched=${model.enriched} catalysts=${model.catalysts}`,
      );

      return result;
    });
  }

  private async runPipelineSteps(
    ctx: ScanRunContext,
    selectedSteps: PipelineStepId[],
    options?: PipelineRunOptions,
  ): Promise<PipelineResult> {
    const pipelineSteps = selectedSteps.filter((step) =>
      PIPELINE_STEP_IDS.includes(step),
    );

    if (pipelineSteps.length === 0) {
      for (const step of PIPELINE_STEP_IDS) {
        ctx.recordStep(step, 'skipped', 0, 'outside selected range');
      }
      return {
        synced: 0,
        failed: 0,
        indicatorsUpdated: 0,
        rsRanked: 0,
        completedAt: new Date(),
        durationMs: 0,
      };
    }

    return this.pipelineService.runFullPipeline({
      ...options,
      fromStep: pipelineSteps[0],
      toStep: pipelineSteps[pipelineSteps.length - 1],
      onStepTiming: (stepId, status, durationMs, reason) =>
        ctx.recordStep(stepId, status, durationMs, reason),
    });
  }

  private async getLatestFocusListId(): Promise<string | null> {
    const focusList = await this.prisma.focusList.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return focusList?.id ?? null;
  }

  /**
   * DeepSeek text-review pass over the fresh focus list: enrich metadata for
   * leaders/candidates still missing it, then generate catalyst hypotheses for
   * the themes those names belong to. Bounded by env limits and attributed to
   * the scan run so token cost is recorded. Model failures are non-fatal so a
   * provider hiccup never fails the whole scan.
   */
  private async runModelReview(
    ctx: ScanRunContext,
    focusListId: string,
  ): Promise<{ enriched: number; catalysts: number }> {
    const enrichLimit = this.intFromEnv('RESEARCH_ENRICH_LIMIT', 25);
    const catalystLimit = this.intFromEnv('RESEARCH_CATALYST_LIMIT', 8);

    const focusItems = await this.prisma.focusListItem.findMany({
      where: { focusListId },
      select: { stockId: true },
    });
    const stockIds = focusItems.map((i) => i.stockId);

    let enriched = 0;
    if (enrichLimit > 0 && stockIds.length > 0) {
      try {
        const outcomes = await this.metadataService.enrichMissingForStocks(
          stockIds,
          enrichLimit,
          ctx.scanRunId,
        );
        enriched = outcomes.filter((o) => o.updated).length;
      } catch (err) {
        this.logger.warn(
          `Metadata enrichment step failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    let catalysts = 0;
    if (catalystLimit > 0 && stockIds.length > 0) {
      catalysts = await this.generateCatalystsForFocus(
        stockIds,
        catalystLimit,
        ctx.scanRunId,
      );
    }

    await this.applyModelCounts(ctx);
    return { enriched, catalysts };
  }

  /**
   * Generate catalyst hypotheses for themes attached to the focus names that do
   * not already have an open (WATCHING) catalyst, capped at `limit`.
   */
  private async generateCatalystsForFocus(
    stockIds: string[],
    limit: number,
    scanRunId: string,
  ): Promise<number> {
    const memberships = await this.prisma.tickerThemeMembership.findMany({
      where: { stockId: { in: stockIds } },
      select: { themeId: true },
      distinct: ['themeId'],
    });
    const themeIds = memberships.map((m) => m.themeId);
    if (themeIds.length === 0) return 0;

    const existing = await this.prisma.catalystHypothesis.findMany({
      where: { themeId: { in: themeIds }, status: 'WATCHING' },
      select: { themeId: true },
    });
    const covered = new Set(existing.map((c) => c.themeId));

    const pending = themeIds.filter((id) => !covered.has(id)).slice(0, limit);
    let created = 0;
    for (const themeId of pending) {
      try {
        const catalyst = await this.catalystService.generateForTheme(
          themeId,
          scanRunId,
        );
        if (catalyst) created++;
      } catch (err) {
        this.logger.warn(
          `Catalyst generation failed for theme ${themeId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return created;
  }

  /** Sum token/cost from model reviews recorded under this scan run. */
  private async applyModelCounts(ctx: ScanRunContext): Promise<void> {
    const agg = await this.prisma.modelReview.aggregate({
      where: { scanRunId: ctx.scanRunId },
      _sum: { inputTokens: true, outputTokens: true, costEstimate: true },
    });
    ctx.setCounts({
      modelInputTokens: agg._sum.inputTokens ?? 0,
      modelOutputTokens: agg._sum.outputTokens ?? 0,
      modelCostEstimate: agg._sum.costEstimate
        ? Number(agg._sum.costEstimate)
        : 0,
    });
  }
}
