import { Injectable, Logger } from '@nestjs/common';
import {
  CatalystHypothesis,
  CatalystStatus,
  Direction,
  Prisma,
  SetupState,
  StageEnum,
  StockCategory,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelReviewService } from './model/model-review.service';

interface CatalystModelResult {
  title?: string;
  hypothesis?: string;
  beneficiaries?: unknown[];
  losers?: unknown[];
  sourceUrls?: unknown[];
  confidence?: number;
}

export interface CreateCatalystInput {
  title: string;
  hypothesis: string;
  themeId?: string;
  groupId?: string;
  sourceUrls?: string[];
  expectedBeneficiaries?: unknown[];
  expectedLosers?: unknown[];
  confidenceScore?: number;
}

type CatalystVerificationVerdict =
  | 'ALIGNED'
  | 'MIXED'
  | 'NOT_ALIGNED'
  | 'NO_SETUP_EVIDENCE';

type CatalystAffectedRole = 'BENEFICIARY' | 'LOSER';
type CatalystThemeCondition =
  | 'SETUP_LONG'
  | 'SETUP_SHORT'
  | 'HEALTHY_STAGE_2'
  | 'MIXED'
  | 'WEAK'
  | 'NO_EVIDENCE';

interface CatalystAffectedStock {
  stockId: string;
  ticker: string;
  name: string;
  role: CatalystAffectedRole;
  source: string;
}

interface CatalystSetupSnapshot {
  stockId: string;
  type: string;
  state: SetupState;
  direction: Direction;
  pivotPrice: Prisma.Decimal | null;
  stopPrice: Prisma.Decimal | null;
  targetPrice: Prisma.Decimal | null;
  detectedAt: Date;
}

interface CatalystStageSnapshot {
  stockId: string;
  stage: StageEnum;
  category: StockCategory;
  date: Date;
}

export interface CatalystTechnicalVerification {
  checkedAt: string;
  verdict: CatalystVerificationVerdict;
  themeCondition: CatalystThemeCondition;
  summary: string;
  counts: {
    checked: number;
    aligned: number;
    mismatched: number;
    missingSetup: number;
    withSetup: number;
    longSetups: number;
    shortSetups: number;
  };
  setupSide: Direction | null;
  stageHealth: {
    stage2Share: number;
    constructiveShare: number;
    weakShare: number;
    stageCounts: Record<StageEnum | 'UNKNOWN', number>;
    categoryCounts: Record<StockCategory | 'UNKNOWN', number>;
  };
  affectedStocks: Array<{
    ticker: string;
    name: string;
    role: CatalystAffectedRole;
    stage: StageEnum | null;
    category: StockCategory | null;
    stockStatus: string;
    setupDirection: Direction | null;
    setupType: string | null;
    setupState: SetupState | null;
    aligned: boolean;
    reason: string;
  }>;
}

/**
 * Generates and tracks catalyst hypotheses (theme/group level). Generation
 * runs through the model provider (mock until a key is configured); created
 * hypotheses start in WATCHING and are confirmed/rejected as evidence accrues.
 */
@Injectable()
export class CatalystService {
  private readonly logger = new Logger(CatalystService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelReview: ModelReviewService,
  ) {}

  async generateForTheme(
    themeId: string,
    scanRunId?: string,
  ): Promise<CatalystHypothesis | null> {
    const theme = await this.prisma.theme.findUniqueOrThrow({
      where: { id: themeId },
      include: { groups: { select: { name: true } } },
    });

    const review = await this.modelReview.review({
      reviewType: 'CATALYST_SEARCH',
      targetType: 'theme',
      targetId: theme.id,
      scanRunId,
      prompt:
        'Identify the single strongest current catalyst for this theme and frame it so price action can confirm or reject it. ' +
        'beneficiaries and losers should be specific tickers/groups across the supply chain. ' +
        'Return JSON with keys: title (string), hypothesis (string), ' +
        'beneficiaries (array of strings), losers (array of strings), ' +
        'sourceUrls (array of strings — only real URLs you are confident about, else empty), ' +
        'confidence (0-1 reflecting evidence strength).',
      payload: {
        theme: theme.name,
        description: theme.description,
        groups: theme.groups.map((g) => g.name),
      },
    });

    const result = (review.resultJson ?? {}) as CatalystModelResult;
    // The mock provider returns confidence 0 and an empty hypothesis — skip
    // persisting an empty catalyst so we don't pollute the table.
    if (!result.hypothesis || (result.confidence ?? 0) <= 0) {
      this.logger.debug(`No catalyst generated for theme ${theme.name} (mock/empty)`);
      return null;
    }

    return this.create({
      title: result.title ?? `${theme.name} catalyst`,
      hypothesis: result.hypothesis,
      themeId: theme.id,
      sourceUrls: this.toStringArray(result.sourceUrls),
      expectedBeneficiaries: result.beneficiaries ?? [],
      expectedLosers: result.losers ?? [],
      confidenceScore: result.confidence,
    });
  }

  async create(input: CreateCatalystInput): Promise<CatalystHypothesis> {
    const catalyst = await this.prisma.catalystHypothesis.create({
      data: {
        title: input.title,
        hypothesis: input.hypothesis,
        themeId: input.themeId ?? null,
        groupId: input.groupId ?? null,
        sourceUrlsJson: this.toJson(input.sourceUrls),
        expectedBeneficiariesJson: this.toJson(input.expectedBeneficiaries),
        expectedLosersJson: this.toJson(input.expectedLosers),
        confidenceScore:
          input.confidenceScore != null
            ? new Prisma.Decimal(Math.max(0, Math.min(1, input.confidenceScore)))
            : null,
      },
    });
    return this.verify(catalyst.id);
  }

  list(status?: CatalystStatus, limit = 50): Promise<CatalystHypothesis[]> {
    return this.prisma.catalystHypothesis.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { theme: { select: { name: true } } },
    });
  }

  get(id: string): Promise<CatalystHypothesis | null> {
    return this.prisma.catalystHypothesis.findUnique({ where: { id } });
  }

  updateStatus(id: string, status: CatalystStatus): Promise<CatalystHypothesis> {
    return this.prisma.catalystHypothesis.update({
      where: { id },
      data: { status },
    });
  }

  async verify(id: string): Promise<CatalystHypothesis> {
    const catalyst = await this.prisma.catalystHypothesis.findUniqueOrThrow({
      where: { id },
    });
    const verification = await this.buildTechnicalVerification(catalyst);
    return this.prisma.catalystHypothesis.update({
      where: { id },
      data: { technicalVerificationJson: this.toJson(verification) },
      include: { theme: { select: { name: true } } },
    });
  }

  private async buildTechnicalVerification(
    catalyst: CatalystHypothesis,
  ): Promise<CatalystTechnicalVerification> {
    const affected = await this.resolveAffectedStocks(catalyst);
    const setupsByStock = await this.loadActiveDailySetups(
      affected.map((stock) => stock.stockId),
    );
    const stagesByStock = await this.loadLatestStages(
      affected.map((stock) => stock.stockId),
    );

    const rows = affected.map((stock) => {
      const setup = this.pickPrimarySetup(setupsByStock.get(stock.stockId) ?? []);
      const stage = stagesByStock.get(stock.stockId) ?? null;
      const stageFields = {
        stage: stage?.stage ?? null,
        category: stage?.category ?? null,
        stockStatus: this.describeStockStatus(stage),
      };
      if (!setup) {
        return {
          ticker: stock.ticker,
          name: stock.name,
          role: stock.role,
          ...stageFields,
          setupDirection: null,
          setupType: null,
          setupState: null,
          aligned: false,
          reason: 'No active daily setup found.',
        };
      }

      return {
        ticker: stock.ticker,
        name: stock.name,
        role: stock.role,
        ...stageFields,
        setupDirection: setup.direction,
        setupType: setup.type,
        setupState: setup.state,
        aligned: false,
        reason: `${setup.type} is ${setup.state.toLowerCase()} and points ${setup.direction.toLowerCase()}.`,
      };
    });

    const checked = rows.length;
    const longSetups = rows.filter((row) => row.setupDirection === Direction.LONG).length;
    const shortSetups = rows.filter((row) => row.setupDirection === Direction.SHORT).length;
    const withSetup = longSetups + shortSetups;
    const missingSetup = checked - withSetup;
    const setupSide =
      longSetups === shortSetups
        ? null
        : longSetups > shortSetups
          ? Direction.LONG
          : Direction.SHORT;
    const affectedStocks = rows.map((row) => {
      const aligned = setupSide != null && row.setupDirection === setupSide;
      return {
        ...row,
        aligned,
        reason:
          row.setupDirection == null
            ? row.reason
            : aligned
              ? `${row.reason} This matches the group setup side.`
              : `${row.reason} This is opposite the group setup side.`,
      };
    });
    const aligned = affectedStocks.filter((row) => row.aligned).length;
    const mismatched = withSetup - aligned;
    const stageHealth = this.buildStageHealth(rows);
    const verdict = this.deriveVerificationVerdict({
      checked,
      aligned,
      mismatched,
      missingSetup,
      withSetup,
    });
    const themeCondition = this.deriveThemeCondition({
      verdict,
      setupSide,
      stageHealth,
    });

    return {
      checkedAt: new Date().toISOString(),
      verdict,
      themeCondition,
      summary: this.buildVerificationSummary(verdict, {
        checked,
        aligned,
        mismatched,
        missingSetup,
        withSetup,
      }, themeCondition, stageHealth),
      counts: {
        checked,
        aligned,
        mismatched,
        missingSetup,
        withSetup,
        longSetups,
        shortSetups,
      },
      setupSide,
      stageHealth,
      affectedStocks,
    };
  }

  private async resolveAffectedStocks(
    catalyst: CatalystHypothesis,
  ): Promise<CatalystAffectedStock[]> {
    const beneficiaryTerms = this.extractTextTerms(catalyst.expectedBeneficiariesJson);
    const loserTerms = this.extractTextTerms(catalyst.expectedLosersJson);
    const beneficiaryTickers = this.extractTickerTokens(beneficiaryTerms);
    const loserTickers = this.extractTickerTokens(loserTerms);
    const explicitTickers = [...new Set([...beneficiaryTickers, ...loserTickers])];

    const byStockId = new Map<string, CatalystAffectedStock>();
    if (explicitTickers.length > 0) {
      const stocks = await this.prisma.stock.findMany({
        where: { ticker: { in: explicitTickers }, isActive: true },
        select: { id: true, ticker: true, name: true },
      });
      const byTicker = new Map(stocks.map((stock) => [stock.ticker.toUpperCase(), stock]));

      for (const ticker of beneficiaryTickers) {
        const stock = byTicker.get(ticker);
        if (!stock || byStockId.has(stock.id)) continue;
        byStockId.set(stock.id, {
          stockId: stock.id,
          ticker: stock.ticker,
          name: stock.name,
          role: 'BENEFICIARY',
          source: 'expectedBeneficiariesJson',
        });
      }

      for (const ticker of loserTickers) {
        const stock = byTicker.get(ticker);
        if (!stock || byStockId.has(stock.id)) continue;
        byStockId.set(stock.id, {
          stockId: stock.id,
          ticker: stock.ticker,
          name: stock.name,
          role: 'LOSER',
          source: 'expectedLosersJson',
        });
      }
    }

    if (byStockId.size === 0 && (catalyst.groupId || catalyst.themeId)) {
      const themeStocks = await this.prisma.themeStock.findMany({
        where: catalyst.groupId
          ? { groupId: catalyst.groupId }
          : { group: { themeId: catalyst.themeId ?? undefined } },
        take: 80,
        include: { stock: { select: { id: true, ticker: true, name: true } } },
      });

      for (const themeStock of themeStocks) {
        byStockId.set(themeStock.stock.id, {
          stockId: themeStock.stock.id,
          ticker: themeStock.stock.ticker,
          name: themeStock.stock.name,
          role: 'BENEFICIARY',
          source: catalyst.groupId ? 'groupMembership' : 'themeMembership',
        });
      }
    }

    return [...byStockId.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  private async loadActiveDailySetups(
    stockIds: string[],
  ): Promise<Map<string, CatalystSetupSnapshot[]>> {
    const byStock = new Map<string, CatalystSetupSnapshot[]>();
    if (stockIds.length === 0) return byStock;

    const setups = await this.prisma.setup.findMany({
      where: {
        stockId: { in: stockIds },
        timeframe: 'DAILY',
        state: { in: [SetupState.BUILDING, SetupState.READY, SetupState.TRIGGERED] },
      },
      select: {
        stockId: true,
        type: true,
        state: true,
        direction: true,
        pivotPrice: true,
        stopPrice: true,
        targetPrice: true,
        detectedAt: true,
      },
    });

    for (const setup of setups) {
      const list = byStock.get(setup.stockId) ?? [];
      list.push(setup as CatalystSetupSnapshot);
      byStock.set(setup.stockId, list);
    }
    return byStock;
  }

  private async loadLatestStages(
    stockIds: string[],
  ): Promise<Map<string, CatalystStageSnapshot>> {
    const byStock = new Map<string, CatalystStageSnapshot>();
    if (stockIds.length === 0) return byStock;

    const stages = await this.prisma.stockStage.findMany({
      where: { stockId: { in: stockIds } },
      select: {
        stockId: true,
        stage: true,
        category: true,
        date: true,
      },
      orderBy: { date: 'desc' },
    });

    for (const stage of stages) {
      if (!byStock.has(stage.stockId)) {
        byStock.set(stage.stockId, stage);
      }
    }
    return byStock;
  }

  private pickPrimarySetup(
    setups: CatalystSetupSnapshot[],
  ): CatalystSetupSnapshot | null {
    if (setups.length === 0) return null;
    return [...setups].sort((a, b) => {
      const stateRank = this.setupStateRank(b.state) - this.setupStateRank(a.state);
      if (stateRank !== 0) return stateRank;
      return b.detectedAt.getTime() - a.detectedAt.getTime();
    })[0];
  }

  private setupStateRank(state: SetupState): number {
    switch (state) {
      case SetupState.TRIGGERED:
        return 3;
      case SetupState.READY:
        return 2;
      case SetupState.BUILDING:
        return 1;
      default:
        return 0;
    }
  }

  private deriveVerificationVerdict(counts: {
    checked: number;
    aligned: number;
    mismatched: number;
    missingSetup: number;
    withSetup: number;
  }): CatalystVerificationVerdict {
    if (counts.checked === 0 || counts.withSetup === 0) return 'NO_SETUP_EVIDENCE';
    const minimumGroupSize = counts.checked > 1 ? 2 : 1;
    if (counts.aligned < minimumGroupSize) return 'NOT_ALIGNED';
    const alignedShare = counts.aligned / counts.withSetup;
    if (alignedShare >= 0.67) return 'ALIGNED';
    return 'MIXED';
  }

  private buildStageHealth(
    rows: Array<{ stage: StageEnum | null; category: StockCategory | null }>,
  ): CatalystTechnicalVerification['stageHealth'] {
    const stageCounts: Record<StageEnum | 'UNKNOWN', number> = {
      STAGE_1: 0,
      STAGE_2: 0,
      STAGE_3: 0,
      STAGE_4: 0,
      UNKNOWN: 0,
    };
    const categoryCounts: Record<StockCategory | 'UNKNOWN', number> = {
      HOT: 0,
      FORMER_HOT: 0,
      COMMODITY: 0,
      NONE: 0,
      UNKNOWN: 0,
    };

    for (const row of rows) {
      stageCounts[row.stage ?? 'UNKNOWN'] += 1;
      categoryCounts[row.category ?? 'UNKNOWN'] += 1;
    }

    const total = rows.length || 1;
    const stage2 = stageCounts.STAGE_2;
    const constructive = stageCounts.STAGE_1 + stageCounts.STAGE_2;
    const weak = stageCounts.STAGE_3 + stageCounts.STAGE_4;
    return {
      stage2Share: stage2 / total,
      constructiveShare: constructive / total,
      weakShare: weak / total,
      stageCounts,
      categoryCounts,
    };
  }

  private deriveThemeCondition(input: {
    verdict: CatalystVerificationVerdict;
    setupSide: Direction | null;
    stageHealth: CatalystTechnicalVerification['stageHealth'];
  }): CatalystThemeCondition {
    if (input.verdict === 'ALIGNED' && input.setupSide === Direction.LONG) {
      return 'SETUP_LONG';
    }
    if (input.verdict === 'ALIGNED' && input.setupSide === Direction.SHORT) {
      return 'SETUP_SHORT';
    }
    if (input.stageHealth.stage2Share >= 0.5) return 'HEALTHY_STAGE_2';
    if (input.stageHealth.weakShare >= 0.5) return 'WEAK';
    if (
      input.stageHealth.stageCounts.UNKNOWN ===
      Object.values(input.stageHealth.stageCounts).reduce((sum, count) => sum + count, 0)
    ) {
      return 'NO_EVIDENCE';
    }
    return 'MIXED';
  }

  private describeStockStatus(stage: CatalystStageSnapshot | null): string {
    if (!stage) return 'No stage data';
    const category =
      stage.category === StockCategory.NONE ? '' : ` / ${stage.category.replace(/_/g, ' ')}`;
    switch (stage.stage) {
      case StageEnum.STAGE_2:
        return `Healthy Stage 2${category}`;
      case StageEnum.STAGE_1:
        return `Constructive Stage 1${category}`;
      case StageEnum.STAGE_3:
        return `Distribution Stage 3${category}`;
      case StageEnum.STAGE_4:
        return `Weak Stage 4${category}`;
      default:
        return 'No stage data';
    }
  }

  private buildVerificationSummary(
    verdict: CatalystVerificationVerdict,
    counts: {
      checked: number;
      aligned: number;
      mismatched: number;
      missingSetup: number;
      withSetup: number;
    },
    themeCondition: CatalystThemeCondition,
    stageHealth: CatalystTechnicalVerification['stageHealth'],
  ): string {
    const stage2Count = stageHealth.stageCounts.STAGE_2;
    const weakCount = stageHealth.stageCounts.STAGE_3 + stageHealth.stageCounts.STAGE_4;
    const stageNote = `${stage2Count} Stage 2, ${weakCount} Stage 3/4`;
    if (counts.checked === 0) {
      return 'No affected stocks could be mapped to the catalyst yet.';
    }
    if (counts.withSetup === 0) {
      if (themeCondition === 'HEALTHY_STAGE_2') {
        return `${counts.checked} affected stocks were mapped with no active daily setups yet, but the group is healthy (${stageNote}).`;
      }
      return `${counts.checked} affected stocks were mapped, but none have active daily setups yet (${stageNote}).`;
    }
    if (verdict === 'ALIGNED') {
      return `${counts.aligned} of ${counts.withSetup} active setups point to the same side, showing group setup alignment (${stageNote}).`;
    }
    if (verdict === 'NOT_ALIGNED') {
      return `${counts.withSetup} affected stocks have active setups, but there is not enough group alignment yet (${stageNote}).`;
    }
    if (verdict === 'NO_SETUP_EVIDENCE') {
      return `${counts.checked} affected stocks were mapped, but no active daily setup was found (${stageNote}).`;
    }
    return `${counts.aligned} of ${counts.withSetup} active setups point to one side; ${counts.mismatched} point the other way and ${counts.missingSetup} have no active daily setup (${stageNote}).`;
  }

  private extractTextTerms(value: Prisma.JsonValue | null): string[] {
    const terms: string[] = [];
    const visit = (node: unknown) => {
      if (typeof node === 'string') {
        terms.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (node && typeof node === 'object') {
        Object.values(node as Record<string, unknown>).forEach(visit);
      }
    };
    visit(value);
    return terms;
  }

  private extractTickerTokens(terms: string[]): string[] {
    const ignore = new Set([
      'AI',
      'API',
      'CPU',
      'EDA',
      'ETF',
      'EU',
      'EV',
      'GPU',
      'HPC',
      'IPO',
      'LLM',
      'M&A',
      'PC',
      'SaaS',
      'SEC',
      'US',
      'USA',
    ]);
    const tokens = new Set<string>();
    for (const term of terms) {
      for (const match of term.toUpperCase().matchAll(/\b[A-Z]{1,5}(?:\.[A-Z])?\b/g)) {
        const token = match[0];
        if (!ignore.has(token)) tokens.add(token);
      }
    }
    return [...tokens];
  }

  private toStringArray(value: unknown[] | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
