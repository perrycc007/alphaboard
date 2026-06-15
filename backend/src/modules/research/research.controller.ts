import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  CatalystStatus,
  Direction,
  MarketScopeType,
  ModelReviewType,
  ScanRun,
  SetupBias,
  SetupType,
} from '@prisma/client';
import { FullScanService } from './full-scan.service';
import { ScanRunService } from './scan-run.service';
import {
  FULL_SCAN_STEP_IDS,
  selectPipelineSteps,
} from '../data-ingestion/services/pipeline-steps';
import {
  UniverseFilterService,
  TradableUniverseCandidate,
} from './universe-filter.service';
import { FocusListService } from './focus-list.service';
import { DailyUpdateService, DailyUpdateResult } from './daily-update.service';
import { MarketConditionService } from './market-condition.service';
import { MetadataEnrichmentService } from './metadata-enrichment.service';
import { CatalystService } from './catalyst.service';
import { RecommendationService } from './recommendation.service';
import { StrategyReportService } from './strategy-report.service';
import { OpportunityHypothesisService } from './opportunity-hypothesis.service';
import type { OpportunityHypothesisInput } from './opportunity-hypothesis.service';
import { TechnicalReviewService } from './technical-review.service';
import type { TechnicalReviewInput } from './technical-review.service';
import { StrategyEffectivenessService } from './strategy-effectiveness.service';
import { ModelReviewService } from './model/model-review.service';
import {
  MODEL_PROVIDER,
} from './model/model-provider.interface';
import type { ModelProvider } from './model/model-provider.interface';

interface ManualAddBody {
  stockId: string;
  setupBias?: SetupBias;
  priorityScore?: number;
  themeId?: string;
  groupId?: string;
}

interface CreateCatalystBody {
  title: string;
  hypothesis: string;
  themeId?: string;
  groupId?: string;
  sourceUrls?: string[];
  confidenceScore?: number;
}

interface CreateRecommendationBody {
  stockId: string;
  direction: Direction;
  entryZone?: { low: number; high: number };
  stopLevel?: number;
  targetLevels?: number[];
  thesis?: string;
  confidenceScore?: number;
}

/**
 * Research workflow orchestration endpoints.
 */
@Controller('api/research')
@AllowAnonymous()
export class ResearchController {
  constructor(
    private readonly fullScanService: FullScanService,
    private readonly scanRunService: ScanRunService,
    private readonly universeFilterService: UniverseFilterService,
    private readonly focusListService: FocusListService,
    private readonly dailyUpdateService: DailyUpdateService,
    private readonly marketConditionService: MarketConditionService,
    private readonly metadataService: MetadataEnrichmentService,
    private readonly catalystService: CatalystService,
    private readonly recommendationService: RecommendationService,
    private readonly strategyReportService: StrategyReportService,
    private readonly opportunityHypothesisService: OpportunityHypothesisService,
    private readonly technicalReviewService: TechnicalReviewService,
    private readonly strategyEffectivenessService: StrategyEffectivenessService,
    private readonly modelReviewService: ModelReviewService,
    @Inject(MODEL_PROVIDER) private readonly modelProvider: ModelProvider,
  ) {}

  // ── Full scan + scan runs ──

  /** POST /api/research/full-scan -- Trigger a tracked full scan (background). */
  @Post('full-scan')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerFullScan(
    @Query('skipBackfill') skipBackfill?: string,
    @Query('fromStep') fromStep?: string,
    @Query('toStep') toStep?: string,
  ): { message: string } {
    if (this.fullScanService.isRunning()) {
      return { message: 'Full scan is already running' };
    }

    try {
      selectPipelineSteps(fromStep, toStep, FULL_SCAN_STEP_IDS);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }

    const skip =
      skipBackfill === 'true' ||
      process.env.PIPELINE_SKIP_BACKFILL?.toLowerCase() === 'true';
    this.fullScanService
      .run({
        fromStep,
        toStep,
        ...(skip ? { skipBackfill: true } : {}),
      })
      .catch(() => undefined);
    return {
      message: skip
        ? 'Full scan started (backfill skipped)'
        : 'Full scan started',
    };
  }

  /** GET /api/research/scan-runs -- List recent scan runs, newest first. */
  @Get('scan-runs')
  listScanRuns(): Promise<ScanRun[]> {
    return this.scanRunService.list();
  }

  /** GET /api/research/scan-runs/:id -- Fetch a single scan run. */
  @Get('scan-runs/:id')
  async getScanRun(@Param('id') id: string): Promise<ScanRun> {
    const run = await this.scanRunService.get(id);
    if (!run) throw new NotFoundException(`Scan run ${id} not found`);
    return run;
  }

  // ── Universe ──

  /**
   * GET /api/research/universe -- Tradable universe candidates for setup detection.
   * Query: minPrice, minAvgVolume, pinned (comma-separated), includeStage4 (true/false).
   */
  @Get('universe')
  getUniverse(
    @Query('minPrice') minPrice?: string,
    @Query('minAvgVolume') minAvgVolume?: string,
    @Query('pinned') pinned?: string,
    @Query('includeStage4') includeStage4?: string,
  ): Promise<TradableUniverseCandidate[]> {
    return this.universeFilterService.getTradableUniverse({
      minPrice: minPrice ? Number(minPrice) : undefined,
      minAvgVolume: minAvgVolume ? Number(minAvgVolume) : undefined,
      pinnedTickers: pinned
        ? pinned.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined,
      includeStage4: includeStage4 === 'true',
    });
  }

  // ── Focus list ──

  /** GET /api/research/focus-list/current -- The current active focus list. */
  @Get('focus-list/current')
  getCurrentFocusList() {
    return this.focusListService.getCurrent();
  }

  /** GET /api/research/focus-lists -- All focus lists, newest first. */
  @Get('focus-lists')
  listFocusLists() {
    return this.focusListService.listAll();
  }

  /** POST /api/research/focus-list/manual-add -- Pin a stock to the manual list. */
  @Post('focus-list/manual-add')
  @HttpCode(HttpStatus.CREATED)
  async manualAdd(@Body() body: ManualAddBody): Promise<{ message: string }> {
    if (!body?.stockId) {
      throw new BadRequestException('stockId is required');
    }
    await this.focusListService.manualAdd({
      stockId: body.stockId,
      reason: 'MANUAL_PIN',
      setupBias: body.setupBias,
      priorityScore: body.priorityScore,
      themeId: body.themeId,
      groupId: body.groupId,
    });
    return { message: `Pinned ${body.stockId}` };
  }

  // ── Daily update ──

  /** POST /api/research/daily-update -- Refresh focus-list stocks and decide focusToday. */
  @Post('daily-update')
  runDailyUpdate(): Promise<DailyUpdateResult> {
    return this.dailyUpdateService.run();
  }

  // ── Market condition ──

  /** POST /api/research/market-condition/rebuild -- Recompute condition snapshots. */
  @Post('market-condition/rebuild')
  @HttpCode(HttpStatus.OK)
  async rebuildMarketCondition(): Promise<{ written: number }> {
    const written = await this.marketConditionService.rebuild();
    return { written };
  }

  /** GET /api/research/market-condition -- Latest condition snapshots (all scopes). */
  @Get('market-condition')
  getMarketCondition() {
    return this.marketConditionService.getLatestAll();
  }

  /** GET /api/research/market-condition/:scopeType/:scopeKey -- History for a scope. */
  @Get('market-condition/:scopeType/:scopeKey')
  getMarketConditionHistory(
    @Param('scopeType') scopeType: MarketScopeType,
    @Param('scopeKey') scopeKey: string,
  ) {
    return this.marketConditionService.getHistory(scopeType, scopeKey);
  }

  // ── Metadata enrichment ──

  /** POST /api/research/metadata/enrich -- Enrich tickers missing metadata (mock until key set). */
  @Post('metadata/enrich')
  @HttpCode(HttpStatus.OK)
  enrichMetadata(@Body() body: { limit?: number }) {
    return this.metadataService.enrichMissing(body?.limit ?? 25);
  }

  // ── Catalysts ──

  /** GET /api/research/catalysts -- List catalyst hypotheses (optionally by status). */
  @Get('catalysts')
  listCatalysts(@Query('status') status?: CatalystStatus) {
    return this.catalystService.list(status);
  }

  /** POST /api/research/catalysts -- Create a catalyst hypothesis manually. */
  @Post('catalysts')
  @HttpCode(HttpStatus.CREATED)
  createCatalyst(@Body() body: CreateCatalystBody) {
    if (!body?.title || !body?.hypothesis) {
      throw new BadRequestException('title and hypothesis are required');
    }
    return this.catalystService.create(body);
  }

  /** POST /api/research/catalysts/theme/:themeId -- Generate a catalyst via the model. */
  @Post('catalysts/theme/:themeId')
  @HttpCode(HttpStatus.OK)
  generateCatalyst(@Param('themeId') themeId: string) {
    return this.catalystService.generateForTheme(themeId);
  }

  /** PATCH-like: POST /api/research/catalysts/:id/status -- Update catalyst status. */
  @Post('catalysts/:id/status')
  @HttpCode(HttpStatus.OK)
  updateCatalystStatus(
    @Param('id') id: string,
    @Body() body: { status: CatalystStatus },
  ) {
    if (!body?.status) throw new BadRequestException('status is required');
    return this.catalystService.updateStatus(id, body.status);
  }

  // ── Recommendations ──

  /** GET /api/research/recommendations -- Recent strategy recommendations. */
  @Get('recommendations')
  listRecommendations() {
    return this.recommendationService.list();
  }

  /** POST /api/research/recommendations -- Create a recommendation. */
  @Post('recommendations')
  @HttpCode(HttpStatus.CREATED)
  createRecommendation(@Body() body: CreateRecommendationBody) {
    if (!body?.stockId || !body?.direction) {
      throw new BadRequestException('stockId and direction are required');
    }
    return this.recommendationService.create(body);
  }

  /** POST /api/research/recommendations/:id/outcome -- Grade a recommendation. */
  @Post('recommendations/:id/outcome')
  @HttpCode(HttpStatus.OK)
  async gradeRecommendation(@Param('id') id: string) {
    const outcome = await this.recommendationService.computeOutcome(id);
    if (!outcome) {
      throw new BadRequestException(
        'Not enough data to grade (missing entry/stop or future bars)',
      );
    }
    return outcome;
  }

  // ── Report ──

  /** GET /api/research/report -- Composed strategy report (market + focus + catalysts). */
  @Get('report')
  getReport() {
    return this.strategyReportService.generateReport();
  }

  // ── Three-agent research architecture ──

  /**
   * POST /api/research/opportunity-hypotheses/analyze -- Build a causal
   * hypothesis from news + market environment and attach historical analogues.
   */
  @Post('opportunity-hypotheses/analyze')
  @HttpCode(HttpStatus.OK)
  analyzeOpportunity(@Body() body: OpportunityHypothesisInput) {
    return this.opportunityHypothesisService.formHypothesis(body ?? {});
  }

  /**
   * POST /api/research/technical-reviews -- Review a ticker/dataframe/chart
   * packet for setup quality, key levels, and technical actionability.
   */
  @Post('technical-reviews')
  @HttpCode(HttpStatus.OK)
  reviewTechnical(@Body() body: TechnicalReviewInput) {
    return this.technicalReviewService.review(body ?? {});
  }

  /**
   * GET /api/research/strategy-effectiveness -- Rolling report of which setup
   * families are working in current stored outcomes.
   */
  @Get('strategy-effectiveness')
  getStrategyEffectiveness(
    @Query('lookbackDays') lookbackDays?: string,
    @Query('minSampleSize') minSampleSize?: string,
    @Query('setupTypes') setupTypes?: string,
  ) {
    return this.strategyEffectivenessService.report({
      lookbackDays: lookbackDays ? Number(lookbackDays) : undefined,
      minSampleSize: minSampleSize ? Number(minSampleSize) : undefined,
      setupTypes: setupTypes ? this.parseSetupTypes(setupTypes) : undefined,
    });
  }

  /** POST /api/research/focus-list/build -- Build a weekly focus list from the universe. */
  @Post('focus-list/build')
  @HttpCode(HttpStatus.CREATED)
  buildFocusList(@Body() body: { maxItems?: number }) {
    return this.strategyReportService.buildWeeklyFocusList({
      maxItems: body?.maxItems,
    });
  }

  // ── Model reviews ──

  /** GET /api/research/model-reviews -- Recent model reviews (cost/audit trail). */
  @Get('model-reviews')
  listModelReviews(@Query('type') type?: ModelReviewType) {
    return this.modelReviewService.list(type);
  }

  /** GET /api/research/model-provider/status -- Active model provider config. */
  @Get('model-provider/status')
  getModelProviderStatus() {
    return {
      provider: this.modelProvider.name,
      defaultModel: this.modelProvider.model,
    };
  }

  private parseSetupTypes(value: string): SetupType[] {
    const valid = new Set(Object.values(SetupType));
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (!valid.has(item as SetupType)) {
          throw new BadRequestException(`Unknown setup type: ${item}`);
        }
        return item as SetupType;
      });
  }
}
