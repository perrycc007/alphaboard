import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Direction,
  KeyLevelType,
  LeaderPeriodActivity,
  MarketPeriodGranularity,
  MarketRegimeLabel,
  MarketTrendLabel,
  Prisma,
  SetupFamily,
  SetupOutcomeSource,
  SetupState,
  SetupType,
  StageEnum,
  TimingSignalType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IndicatorService } from '../data-ingestion/services/indicator.service';
import { StageClassifierService } from '../stock/services/stage-classifier.service';
import { SetupOrchestratorService } from '../setup/setup-orchestrator.service';
import { getSetupFamily } from './setup-family';
import { detectSignificantSwingPoints } from '../setup/primitives';
import type { Bar } from '../../common/types';
import {
  AggregatedPeriodGranularity,
  buildCalendarBuckets,
  classifyMarketRegime,
  deriveLeaderPeriodActivity,
  extractLeaderRunsFromSeries,
  overlapDays,
  periodSpanDays,
  pickDominantRegimeLabel,
} from './market-regime.helpers';

const PROXY_TICKERS = ['SPY', 'QQQ', 'IWM', 'GLD', 'UUP'] as const;
const EQUITY_PROXY_TICKERS = ['SPY', 'QQQ', 'IWM'] as const;
const LIVE_SAMPLE_THRESHOLD = 12;
const FAMILY_SAMPLE_THRESHOLD = 3;
const ROLLING_WINDOW_DAYS = 60;

type FamilyMetric = {
  count: number;
  winRate: number;
  avgFinalR: number;
  source: 'LIVE' | 'SIMULATED' | 'MIXED' | 'NONE';
};

type ProxyStateSummary = {
  ticker: string;
  stage: StageEnum;
  trend: MarketTrendLabel;
  dominantFamily: SetupFamily | null;
  dominantSetup: SetupType | null;
  close: number;
};

type SetupSummary = {
  type: SetupType;
  state: SetupState;
  direction: Direction;
  detectedAt?: string;
};

type TimingSignalSummary = {
  type: TimingSignalType;
  direction: Direction;
  signalAt: string;
  levelType: KeyLevelType;
  referenceLevel: number;
  triggerPrice: number | null;
  stopPrice: number | null;
};

type LeaderPeriodSummary = {
  ticker: string;
  name: string;
  stage2StartDate: Date;
  stage2EndDate: Date;
  peakGainPct: number;
  entryPrice: number;
  peakPrice: number;
  stageAtPeriodStart: StageEnum | null;
  stageAtPeriodEnd: StageEnum | null;
  activity: LeaderPeriodActivity;
  activityNote: string;
  identifiedSetupLabel: string | null;
  activeSetups: SetupSummary[];
  primarySetup: SetupSummary | null;
  timingSignals: TimingSignalSummary[];
  periodStartClose: number | null;
  periodEndClose: number | null;
  periodReturnPct: number | null;
  shortingEnabled: boolean;
};

type LeaderMarkdownSummary = {
  ticker: string;
  identifiedSetupLabel: string | null;
  activity: LeaderPeriodActivity | null;
  peakGainPct: number;
  stageAtPeriodEnd: StageEnum | null;
  shortingEnabled: boolean;
};

type ComputedPeriodView = {
  granularity: MarketPeriodGranularity;
  periodKey: string;
  startDate: Date;
  endDate: Date;
  label: MarketRegimeLabel;
  liveSampleCount: number;
  simulatedSampleCount: number;
  sourcePeriodCount: number;
  scorecard: Record<string, unknown>;
  proxyStates: ProxyStateSummary[];
};

type SetupOutcomeRow = Prisma.SetupOutcomeCreateManyInput;
type LeaderSnapshotRow = Omit<
  Prisma.MarketLeaderPeriodSnapshotCreateManyInput,
  'marketRegimePeriodId'
>;
type RegimePeriodCreateData = Prisma.MarketRegimePeriodCreateInput;

interface SetupOutcomeMetricRow {
  family: SetupFamily;
  source: SetupOutcomeSource;
  isWin: boolean | null;
  finalR: Prisma.Decimal | null;
  effectiveDate: Date;
}

type FamilyOutcomeAccumulator = {
  count: number;
  wins: number;
  finalRSum: number;
};

type FamilySourceAccumulators = Record<
  SetupFamily,
  {
    live: FamilyOutcomeAccumulator;
    simulated: FamilyOutcomeAccumulator;
  }
>;

interface LeaderSnapshotBuildResult {
  summary: LeaderPeriodSummary[];
  snapshots: LeaderSnapshotRow[];
}

@Injectable()
export class MarketRegimeService {
  private readonly logger = new Logger(MarketRegimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indicatorService: IndicatorService,
    private readonly stageClassifier: StageClassifierService,
    private readonly orchestrator: SetupOrchestratorService,
  ) {}

  async rebuildAll(): Promise<{
    proxies: number;
    leaderRuns: number;
    outcomes: number;
    periods: number;
  }> {
    await this.verifyRebuildSchema();

    const startedAt = Date.now();
    const proxies = await this.runRebuildStep('proxy snapshots', () =>
      this.rebuildProxySnapshots(),
    );
    const leaderRuns = await this.runRebuildStep('leader runs', () =>
      this.rebuildLeaderRuns(),
    );
    const outcomes = await this.runRebuildStep('setup outcomes', () =>
      this.rebuildSetupOutcomes(),
    );
    const periods = await this.runRebuildStep('regime periods', () =>
      this.rebuildRegimePeriods(),
    );
    this.logger.log(
      `Market rebuild completed in ${Date.now() - startedAt}ms (proxies=${proxies}, leaderRuns=${leaderRuns}, outcomes=${outcomes}, periods=${periods})`,
    );
    return { proxies, leaderRuns, outcomes, periods };
  }

  async rebuildProxySnapshots(): Promise<number> {
    const proxies = await this.prisma.indexEntity.findMany({
      where: { ticker: { in: [...PROXY_TICKERS] } },
      include: { dailyBars: { orderBy: { date: 'asc' } } },
    });

    let snapshotCount = 0;

    for (const proxy of proxies) {
      await this.prisma.marketProxySnapshot.deleteMany({
        where: { indexId: proxy.id },
      });

      if (proxy.dailyBars.length < 200) continue;

      const closes = proxy.dailyBars.map((bar) => Number(bar.close));
      const highs = proxy.dailyBars.map((bar) => Number(bar.high));
      const lows = proxy.dailyBars.map((bar) => Number(bar.low));
      const indicators = this.indicatorService.computeAllIndicators(closes, highs, lows);

      const records: Prisma.MarketProxySnapshotCreateManyInput[] = [];

      for (let index = 0; index < proxy.dailyBars.length; index++) {
        const bar = proxy.dailyBars[index];
          const row = indicators[index];
          if (row.sma50 == null || row.sma150 == null || row.sma200 == null) {
            continue;
          }

          const sma200Past = indicators[Math.max(0, index - 30)]?.sma200 ?? row.sma200;
          const rangeStart = Math.max(0, index - 252);
          const rangeHigh = Math.max(...highs.slice(rangeStart, index + 1));
          const rangeLow = Math.min(...lows.slice(rangeStart, index + 1));
          const classification = this.stageClassifier.classify(
            closes[index],
            row.sma50,
            row.sma150,
            row.sma200,
            sma200Past ?? row.sma200,
            rangeHigh,
            rangeLow,
          );

          const trend = this.classifyProxyTrend({
            close: closes[index],
            sma50: row.sma50,
            sma200: row.sma200,
            atr14: row.atr14,
            sma200Past: sma200Past ?? row.sma200,
            stage: classification.stage,
          });

          const setup = this.detectProxySetup({
            bars: proxy.dailyBars.slice(Math.max(0, index - 60), index + 1).map((item) => ({
              open: Number(item.open),
              high: Number(item.high),
              low: Number(item.low),
              close: Number(item.close),
              volume: Number(item.volume),
              date: item.date,
            })),
            trend,
            sma50: row.sma50,
            sma200: row.sma200,
            ema20: row.ema20 ?? undefined,
            atr14: row.atr14 ?? undefined,
          });

          snapshotCount++;

          records.push({
            indexId: proxy.id,
            date: bar.date,
            close: closes[index],
            sma50: row.sma50,
            sma200: row.sma200,
            stage: classification.stage,
            trend,
            dominantFamily: setup?.family ?? null,
            dominantSetup: setup?.type ?? null,
            setupScore: setup?.score ?? null,
            metadata: {
              ticker: proxy.ticker,
              rsLikeTrend: trend,
              classificationCriteria: classification.criteria,
              ema20: row.ema20,
              atr14: row.atr14,
            },
          });
      }

      if (records.length > 0) {
        await this.prisma.marketProxySnapshot.createMany({
          data: records,
        });
      }
    }

    return snapshotCount;
  }

  async rebuildLeaderRuns(): Promise<number> {
    await this.prisma.leaderRun.deleteMany();

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (stocks.length === 0) {
      return 0;
    }

    const stockIds = stocks.map((stock) => stock.id);
    const [allStages, allBars] = await Promise.all([
      this.prisma.stockStage.findMany({
        where: { stockId: { in: stockIds } },
        orderBy: [{ stockId: 'asc' }, { date: 'asc' }],
      }),
      this.prisma.stockDaily.findMany({
        where: { stockId: { in: stockIds } },
        orderBy: [{ stockId: 'asc' }, { date: 'asc' }],
        select: { stockId: true, date: true, close: true, high: true },
      }),
    ]);

    const stagesByStock = this.groupBy(allStages, (item) => item.stockId);
    const barsByStock = this.groupBy(allBars, (item) => item.stockId);
    const rows: Prisma.LeaderRunCreateManyInput[] = [];

    for (const stock of stocks) {
      const stages = stagesByStock.get(stock.id) ?? [];
      const bars = barsByStock.get(stock.id) ?? [];

      if (stages.length === 0 || bars.length === 0) continue;

      const runs = extractLeaderRunsFromSeries(
        stages.map((stage) => ({
          date: stage.date,
          stage: stage.stage,
        })),
        bars.map((bar) => ({
          date: bar.date,
          close: Number(bar.close),
          high: Number(bar.high),
        })),
      );

      rows.push(
        ...runs.map((run) => ({
          stockId: stock.id,
          stage2StartDate: run.stage2StartDate,
          stage2EndDate: run.stage2EndDate,
          entryPrice: run.entryPrice,
          peakPrice: run.peakPrice,
          peakGainPct: run.peakGainPct,
          isQualified: run.isQualified,
        })),
      );
    }

    if (rows.length > 0) {
      await this.createManyInChunks(rows, (data) =>
        this.prisma.leaderRun.createMany({ data }),
      );
    }

    return rows.length;
  }

  async rebuildSetupOutcomes(): Promise<number> {
    await this.prisma.setupOutcome.deleteMany();

    const outcomeRows: SetupOutcomeRow[] = [];

    const liveSetups = await this.prisma.setup.findMany({
      where: { timeframe: 'DAILY' },
      include: { stock: { select: { id: true } } },
    });

    for (const setup of liveSetups) {
      const family = getSetupFamily(setup.type);
      if (!family) continue;

      const stateReason = ((setup.metadata as Record<string, unknown> | null)?.stateReason as string | undefined) ?? null;
      const isWin = stateReason === 'target_reached' ? true : stateReason === 'stop_hit_after_trigger' || stateReason === 'stop_violated' ? false : null;
      const finalR =
        isWin === true ? Number(setup.riskReward ?? 1) : isWin === false ? -1 : null;

      outcomeRows.push({
          setupId: setup.id,
          stockId: setup.stockId,
          source: SetupOutcomeSource.LIVE,
          family,
          setupType: setup.type,
          direction: setup.direction,
          effectiveDate: this.asDateOnly(setup.lastStateAt ?? setup.detectedAt),
          detectedAt: setup.detectedAt,
          entryDate: setup.detectedAt,
          exitDate: setup.state === SetupState.EXPIRED || setup.state === SetupState.VIOLATED ? setup.lastStateAt : null,
          actualStopPrice: setup.stopPrice ?? undefined,
          entryPrice: setup.pivotPrice ?? undefined,
          exitPrice: setup.targetPrice ?? undefined,
          maxR: finalR ?? undefined,
          finalR: finalR ?? undefined,
          isWin,
          metadata: {
            setupState: setup.state,
            stateReason,
          },
      });
    }

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { ticker: true, id: true },
    });

    const simulatedRows = await this.runWithConcurrency(stocks, 4, async (stock) => {
      try {
        const simulated = await this.orchestrator.simulateDetection(stock.ticker);
        const rows: SetupOutcomeRow[] = [];
        for (const setup of simulated) {
          const family = getSetupFamily(setup.type);
          if (!family) continue;

          const effectiveDate = this.asDateOnly(new Date(setup.exitDate ?? setup.detectedAt));
          const isWin =
            setup.finalR != null
              ? setup.finalR > 0
              : setup.maxR != null
                ? setup.maxR >= 2
                : null;

          rows.push({
            stockId: stock.id,
            source: SetupOutcomeSource.SIMULATED,
            family,
            setupType: setup.type,
            direction: setup.direction as Direction,
            effectiveDate,
            detectedAt: new Date(setup.detectedAt),
            entryDate: setup.entryDate ? new Date(setup.entryDate) : null,
            exitDate: setup.exitDate ? new Date(setup.exitDate) : null,
            actualStopPrice: setup.actualStopPrice ?? undefined,
            entryPrice: setup.entryPrice ?? undefined,
            exitPrice: setup.exitPrice ?? undefined,
            maxR: setup.maxR ?? undefined,
            finalR: setup.finalR ?? undefined,
            isWin,
            metadata: {
              state: setup.state,
              holdingDays: setup.holdingDays,
            },
          });
        }
        return rows;
      } catch (error) {
        this.logger.warn(
          `Simulation outcome rebuild failed for ${stock.ticker}: ${String(error)}`,
        );
        return [];
      }
    });

    outcomeRows.push(...simulatedRows.flat());

    if (outcomeRows.length > 0) {
      await this.createManyInChunks(outcomeRows, (data) =>
        this.prisma.setupOutcome.createMany({ data }),
      );
    }

    return outcomeRows.length;
  }

  async rebuildRegimePeriods(): Promise<number> {
    await this.prisma.marketLeaderPeriodSnapshot.deleteMany();
    await this.prisma.marketRegimePeriod.deleteMany();

    const snapshots = await this.prisma.marketProxySnapshot.findMany({
      where: { index: { ticker: { in: [...PROXY_TICKERS] } } },
      include: { index: true },
      orderBy: [{ date: 'asc' }, { index: { ticker: 'asc' } }],
    });

    if (snapshots.length === 0) return 0;

    const groupedByDate = new Map<string, typeof snapshots>();
    for (const snapshot of snapshots) {
      const key = snapshot.date.toISOString().slice(0, 10);
      const list = groupedByDate.get(key) ?? [];
      list.push(snapshot);
      groupedByDate.set(key, list);
    }

    const dates = Array.from(groupedByDate.keys()).sort();
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const metricsWindowStart = new Date(firstDate);
    metricsWindowStart.setDate(metricsWindowStart.getDate() - ROLLING_WINDOW_DAYS);
    const outcomes = await this.prisma.setupOutcome.findMany({
      where: {
        effectiveDate: {
          gte: this.asDateOnly(metricsWindowStart),
          lte: this.asDateOnly(lastDate),
        },
      },
      select: {
        family: true,
        source: true,
        isWin: true,
        finalR: true,
        effectiveDate: true,
      },
    });
    const rollingMetricsByDate = this.buildRollingFamilyMetricsByDate(dates, outcomes);
    const points: Array<{
      date: Date;
      label: MarketRegimeLabel;
      liveSampleCount: number;
      simulatedSampleCount: number;
      scorecard: Record<string, unknown>;
      proxyStates: ProxyStateSummary[];
    }> = [];

    for (const dateKey of dates) {
      const date = new Date(dateKey);
      const daySnapshots = groupedByDate.get(dateKey) ?? [];
      const proxyStates = daySnapshots.map((snapshot) => ({
        ticker: snapshot.index.ticker,
        stage: snapshot.stage,
        trend: snapshot.trend,
        dominantFamily: snapshot.dominantFamily,
        dominantSetup: snapshot.dominantSetup,
        close: Number(snapshot.close),
      }));

      const windowStart = new Date(date);
      windowStart.setDate(windowStart.getDate() - ROLLING_WINDOW_DAYS);

      const metrics =
        rollingMetricsByDate.get(dateKey) ??
        this.buildFamilyMetricsFromRows(outcomes, windowStart, date);
      const label = classifyMarketRegime(proxyStates, metrics);

      points.push({
        date,
        label,
        liveSampleCount:
          metrics.REVERSAL.liveCount +
          metrics.TREND_LONG.liveCount +
          metrics.TREND_SHORT.liveCount,
        simulatedSampleCount:
          metrics.REVERSAL.simulatedCount +
          metrics.TREND_LONG.simulatedCount +
          metrics.TREND_SHORT.simulatedCount,
        scorecard: metrics,
        proxyStates,
      });
    }

    const merged: ComputedPeriodView[] = [];

    for (const point of points) {
      const last = merged[merged.length - 1];
      if (last && last.label === point.label) {
        last.endDate = point.date;
        last.liveSampleCount += point.liveSampleCount;
        last.simulatedSampleCount += point.simulatedSampleCount;
        last.scorecard = point.scorecard;
        last.proxyStates = point.proxyStates;
      } else {
        merged.push({
          granularity: MarketPeriodGranularity.REGIME,
          periodKey: this.buildPeriodKey(
            MarketPeriodGranularity.REGIME,
            point.date,
            point.date,
            merged.length,
          ),
          startDate: point.date,
          endDate: point.date,
          label: point.label,
          liveSampleCount: point.liveSampleCount,
          simulatedSampleCount: point.simulatedSampleCount,
          sourcePeriodCount: 1,
          scorecard: point.scorecard,
          proxyStates: point.proxyStates,
        });
      }
    }

    for (const [index, period] of merged.entries()) {
      period.periodKey = this.buildPeriodKey(
        MarketPeriodGranularity.REGIME,
        period.startDate,
        period.endDate,
        index,
      );
    }

    const derivedPeriods = [
      ...this.buildAggregatedPeriodViews(merged, MarketPeriodGranularity.MONTH),
      ...this.buildAggregatedPeriodViews(merged, MarketPeriodGranularity.YEAR),
    ];

    const allPeriods = [...merged, ...derivedPeriods];

    const createdPeriods = await this.runWithConcurrency(
      allPeriods,
      2,
      async (period) => this.persistPeriodView(period),
    );

    return createdPeriods.length;
  }

  async listPeriods(
    from?: string,
    to?: string,
    granularity: MarketPeriodGranularity = MarketPeriodGranularity.REGIME,
  ) {
    const periods = await this.prisma.marketRegimePeriod.findMany({
      where: {
        granularity,
        ...(from && { endDate: { gte: new Date(from) } }),
        ...(to && { startDate: { lte: new Date(to) } }),
      },
      include: {
        leaderSnapshots: {
          include: {
            stock: {
              select: {
                ticker: true,
                name: true,
              },
            },
          },
          orderBy: [{ shortingEnabled: 'desc' }, { periodReturnPct: 'desc' }],
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return periods.map((period) => ({
      ...period,
      leaderSnapshots: period.leaderSnapshots.map((snapshot) => ({
        ...snapshot,
        stock: snapshot.stock,
      })),
    }));
  }

  async getPeriod(id: string) {
    const period = await this.prisma.marketRegimePeriod.findUnique({
      where: { id },
      include: {
        leaderSnapshots: {
          include: {
            stock: {
              select: {
                ticker: true,
                name: true,
              },
            },
          },
          orderBy: [{ shortingEnabled: 'desc' }, { periodReturnPct: 'desc' }],
        },
      },
    });
    if (!period) {
      throw new NotFoundException(`Market regime period ${id} not found`);
    }
    return period;
  }

  async getLeaderTimeline(
    ticker: string,
    from?: string,
    to?: string,
    granularity: MarketPeriodGranularity = MarketPeriodGranularity.MONTH,
  ) {
    return this.prisma.marketRegimePeriod.findMany({
      where: {
        granularity,
        ...(from && { endDate: { gte: new Date(from) } }),
        ...(to && { startDate: { lte: new Date(to) } }),
        leaderSnapshots: {
          some: {
            stock: {
              ticker: ticker.toUpperCase(),
            },
          },
        },
      },
      include: {
        leaderSnapshots: {
          where: {
            stock: {
              ticker: ticker.toUpperCase(),
            },
          },
          include: {
            stock: {
              select: {
                ticker: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async renderReport(
    from?: string,
    to?: string,
    granularity: MarketPeriodGranularity = MarketPeriodGranularity.REGIME,
  ): Promise<string> {
    const periods = await this.listPeriods(from, to, granularity);
    if (periods.length === 0) {
      return '# Market Regime Report\n\nNo market regime periods available.\n';
    }

    const sections = [...periods]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((period) =>
        period.markdown ??
        this.renderPeriodMarkdown({
          granularity: period.granularity,
          startDate: period.startDate,
          endDate: period.endDate,
          label: period.label,
          liveSampleCount: period.liveSampleCount,
          simulatedSampleCount: period.simulatedSampleCount,
          scorecard: this.toObjectRecord(period.scorecard),
          proxyStates: this.parseProxyStates(period.proxyStates),
          leaderSummary: this.parseLeaderSummary(period.leaderSummary),
        }),
      );

    return ['# Market Regime Report', '', ...sections].join('\n');
  }

  private async persistPeriodView(period: ComputedPeriodView) {
    const periodCreateData: RegimePeriodCreateData = {
      granularity: period.granularity,
      periodKey: period.periodKey,
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label,
      liveSampleCount: period.liveSampleCount,
      simulatedSampleCount: period.simulatedSampleCount,
      sourcePeriodCount: period.sourcePeriodCount,
      scorecard: this.toInputJson(period.scorecard),
      proxyStates: this.toInputJson(period.proxyStates),
      leaderSummary: this.toInputJson([]),
    };

    const leaderData = await this.buildLeaderSnapshots(period.startDate, period.endDate);
    const markdown = this.renderPeriodMarkdown({
      ...period,
      leaderSummary: leaderData.summary,
    });

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketRegimePeriod.create({
        data: periodCreateData,
      });

      if (leaderData.snapshots.length > 0) {
        await tx.marketLeaderPeriodSnapshot.createMany({
          data: leaderData.snapshots.map((snapshot) => ({
            marketRegimePeriodId: created.id,
            ...snapshot,
          })),
        });
      }

      await tx.marketRegimePeriod.update({
        where: { id: created.id },
        data: {
          leaderSummary: this.toInputJson(leaderData.summary),
          markdown,
        },
      });
    });
  }

  private classifyProxyTrend(input: {
    close: number;
    sma50: number;
    sma200: number;
    atr14: number | null;
    sma200Past: number;
    stage: StageEnum;
  }): MarketTrendLabel {
    const atr = input.atr14 ?? 0;
    if (input.stage === StageEnum.STAGE_2 && input.close > input.sma50) {
      return MarketTrendLabel.UPTREND;
    }
    if (
      input.close < input.sma200 &&
      input.sma200 < input.sma200Past
    ) {
      return MarketTrendLabel.DOWNTREND;
    }
    if (atr > 0 && Math.abs(input.sma50 - input.sma200) < atr) {
      return MarketTrendLabel.RANGE;
    }
    return MarketTrendLabel.TRANSITION;
  }

  private detectProxySetup(input: {
    bars: Bar[];
    trend: MarketTrendLabel;
    sma50: number;
    sma200: number;
    ema20?: number;
    atr14?: number;
  }): { type: SetupType; family: SetupFamily | null; score: number } | null {
    const latest = input.bars[input.bars.length - 1];
    if (!latest) return null;

    const recentHigh = Math.max(...input.bars.slice(-20).map((bar) => bar.high));
    const recentLow = Math.min(...input.bars.slice(-20).map((bar) => bar.low));
    const swings = detectSignificantSwingPoints(input.bars.slice(-30));
    const lastHigh = [...swings].reverse().find((point) => point.type === 'HIGH');
    const lastLow = [...swings].reverse().find((point) => point.type === 'LOW');
    const atr = input.atr14 ?? 0;

    if (input.trend === MarketTrendLabel.UPTREND && latest.close >= recentHigh) {
      return { type: SetupType.BREAKOUT_PIVOT, family: SetupFamily.TREND_LONG, score: 70 };
    }

    if (
      input.trend === MarketTrendLabel.UPTREND &&
      input.ema20 != null &&
      latest.low <= input.ema20 + atr &&
      latest.close > input.sma50
    ) {
      return { type: SetupType.EMA20_PULLBACK, family: SetupFamily.TREND_LONG, score: 62 };
    }

    if (
      input.trend === MarketTrendLabel.DOWNTREND &&
      lastHigh &&
      Math.abs(latest.high - lastHigh.price) <= Math.max(atr, 0.5)
    ) {
      return { type: SetupType.DOUBLE_TOP, family: SetupFamily.REVERSAL, score: 58 };
    }

    if (
      input.trend === MarketTrendLabel.RANGE &&
      lastLow &&
      latest.low < lastLow.price &&
      latest.close > lastLow.price
    ) {
      return { type: SetupType.UNDERCUT_RALLY, family: SetupFamily.REVERSAL, score: 55 };
    }

    if (input.trend === MarketTrendLabel.DOWNTREND && latest.close <= recentLow) {
      return { type: SetupType.FAIL_BREAKOUT, family: SetupFamily.TREND_SHORT, score: 65 };
    }

    return null;
  }

  private buildFamilyMetricsFromRows(
    rows: SetupOutcomeMetricRow[],
    windowStart: Date,
    windowEnd: Date,
  ) {
    const outcomes = rows.filter(
      (row) =>
        row.effectiveDate.getTime() >= this.asDateOnly(windowStart).getTime() &&
        row.effectiveDate.getTime() <= this.asDateOnly(windowEnd).getTime(),
    );
    const families: SetupFamily[] = [
      SetupFamily.REVERSAL,
      SetupFamily.TREND_LONG,
      SetupFamily.TREND_SHORT,
    ];
    const totalLiveCount = outcomes.filter(
      (item) => item.source === SetupOutcomeSource.LIVE,
    ).length;

    const metrics = Object.fromEntries(
      families.map((family) => {
        const live = outcomes.filter(
          (outcome) => outcome.family === family && outcome.source === SetupOutcomeSource.LIVE,
        );
        const simulated = outcomes.filter(
          (outcome) => outcome.family === family && outcome.source === SetupOutcomeSource.SIMULATED,
        );
        const preferred =
          live.length >= FAMILY_SAMPLE_THRESHOLD && totalLiveCount >= LIVE_SAMPLE_THRESHOLD
            ? live
            : [...live, ...simulated];

        const winCount = preferred.filter((item) => item.isWin === true).length;
        const avgFinalR =
          preferred.length > 0
            ? preferred.reduce((sum, item) => sum + Number(item.finalR ?? 0), 0) / preferred.length
            : 0;
        const source: FamilyMetric['source'] =
          preferred.length === 0
            ? 'NONE'
            : live.length >= FAMILY_SAMPLE_THRESHOLD &&
                totalLiveCount >= LIVE_SAMPLE_THRESHOLD
              ? 'LIVE'
              : live.length > 0
                ? 'MIXED'
                : 'SIMULATED';

        return [
          family,
          {
            count: preferred.length,
            winRate: preferred.length > 0 ? (winCount / preferred.length) * 100 : 0,
            avgFinalR,
            source,
            liveCount: live.length,
            simulatedCount: simulated.length,
          },
        ];
      }),
    ) as Record<
      SetupFamily,
      FamilyMetric & { liveCount: number; simulatedCount: number }
    >;

    return metrics;
  }

  private buildRollingFamilyMetricsByDate(
    orderedDateKeys: string[],
    rows: SetupOutcomeMetricRow[],
  ): Map<
    string,
    Record<SetupFamily, FamilyMetric & { liveCount: number; simulatedCount: number }>
  > {
    const metricsByDate = new Map<
      string,
      Record<SetupFamily, FamilyMetric & { liveCount: number; simulatedCount: number }>
    >();
    if (orderedDateKeys.length === 0) {
      return metricsByDate;
    }

    const sortedRows = [...rows].sort(
      (a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime(),
    );
    const accumulators = this.createEmptyFamilyAccumulators();
    const windowRows: SetupOutcomeMetricRow[] = [];
    let rowIndex = 0;

    for (const dateKey of orderedDateKeys) {
      const date = this.asDateOnly(new Date(dateKey));
      const windowStart = new Date(date);
      windowStart.setDate(windowStart.getDate() - ROLLING_WINDOW_DAYS);
      const windowStartMs = this.asDateOnly(windowStart).getTime();
      const windowEndMs = date.getTime();

      while (
        rowIndex < sortedRows.length &&
        this.asDateOnly(sortedRows[rowIndex].effectiveDate).getTime() <= windowEndMs
      ) {
        const row = sortedRows[rowIndex];
        windowRows.push(row);
        this.applyOutcomeAccumulator(accumulators, row, 1);
        rowIndex++;
      }

      while (
        windowRows.length > 0 &&
        this.asDateOnly(windowRows[0].effectiveDate).getTime() < windowStartMs
      ) {
        const row = windowRows.shift();
        if (!row) break;
        this.applyOutcomeAccumulator(accumulators, row, -1);
      }

      metricsByDate.set(dateKey, this.buildFamilyMetricsFromAccumulators(accumulators));
    }

    return metricsByDate;
  }

  private createEmptyFamilyAccumulators(): FamilySourceAccumulators {
    return {
      [SetupFamily.REVERSAL]: {
        live: this.createEmptyAccumulator(),
        simulated: this.createEmptyAccumulator(),
      },
      [SetupFamily.TREND_LONG]: {
        live: this.createEmptyAccumulator(),
        simulated: this.createEmptyAccumulator(),
      },
      [SetupFamily.TREND_SHORT]: {
        live: this.createEmptyAccumulator(),
        simulated: this.createEmptyAccumulator(),
      },
    };
  }

  private createEmptyAccumulator(): FamilyOutcomeAccumulator {
    return {
      count: 0,
      wins: 0,
      finalRSum: 0,
    };
  }

  private applyOutcomeAccumulator(
    accumulators: FamilySourceAccumulators,
    row: SetupOutcomeMetricRow,
    delta: 1 | -1,
  ): void {
    const bucket =
      row.source === SetupOutcomeSource.LIVE
        ? accumulators[row.family].live
        : accumulators[row.family].simulated;
    bucket.count += delta;
    if (row.isWin === true) {
      bucket.wins += delta;
    }
    bucket.finalRSum += Number(row.finalR ?? 0) * delta;
  }

  private buildFamilyMetricsFromAccumulators(
    accumulators: FamilySourceAccumulators,
  ): Record<SetupFamily, FamilyMetric & { liveCount: number; simulatedCount: number }> {
    const families: SetupFamily[] = [
      SetupFamily.REVERSAL,
      SetupFamily.TREND_LONG,
      SetupFamily.TREND_SHORT,
    ];
    const liveTotal = families.reduce(
      (sum, family) => sum + accumulators[family].live.count,
      0,
    );

    return Object.fromEntries(
      families.map((family) => {
        const live = accumulators[family].live;
        const simulated = accumulators[family].simulated;
        const preferLiveOnly =
          live.count >= FAMILY_SAMPLE_THRESHOLD && liveTotal >= LIVE_SAMPLE_THRESHOLD;
        const count = preferLiveOnly ? live.count : live.count + simulated.count;
        const wins = preferLiveOnly ? live.wins : live.wins + simulated.wins;
        const finalRSum = preferLiveOnly
          ? live.finalRSum
          : live.finalRSum + simulated.finalRSum;
        const source: FamilyMetric['source'] =
          count === 0
            ? 'NONE'
            : preferLiveOnly
              ? 'LIVE'
              : live.count > 0
                ? 'MIXED'
                : 'SIMULATED';

        return [
          family,
          {
            count,
            winRate: count > 0 ? (wins / count) * 100 : 0,
            avgFinalR: count > 0 ? finalRSum / count : 0,
            source,
            liveCount: live.count,
            simulatedCount: simulated.count,
          },
        ];
      }),
    ) as Record<SetupFamily, FamilyMetric & { liveCount: number; simulatedCount: number }>;
  }

  private buildAggregatedPeriodViews(
    nativePeriods: ComputedPeriodView[],
    granularity: AggregatedPeriodGranularity,
  ): ComputedPeriodView[] {
    if (nativePeriods.length === 0) return [];

    const first = nativePeriods[0];
    const last = nativePeriods[nativePeriods.length - 1];
    const buckets = buildCalendarBuckets(first.startDate, last.endDate, granularity);
    const aggregated: ComputedPeriodView[] = [];

    for (const bucket of buckets) {
      const overlaps = nativePeriods
        .map((period) => ({
          period,
          overlap: overlapDays(
            period.startDate,
            period.endDate,
            bucket.startDate,
            bucket.endDate,
          ),
        }))
        .filter((item) => item.overlap > 0);

      if (overlaps.length === 0) {
        continue;
      }

      const totalOverlap = overlaps.reduce((sum, item) => sum + item.overlap, 0);
      const latestPeriod = overlaps
        .map((item) => item.period)
        .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];

      const families: SetupFamily[] = [
        SetupFamily.REVERSAL,
        SetupFamily.TREND_LONG,
        SetupFamily.TREND_SHORT,
      ];
      const weightedScorecard = Object.fromEntries(
        families.map((family) => {
          let count = 0;
          let weightedWinRate = 0;
          let weightedFinalR = 0;
          let liveCount = 0;
          let simulatedCount = 0;

          for (const item of overlaps) {
            const metric = (item.period.scorecard as Record<
              SetupFamily,
              {
                count: number;
                winRate: number;
                avgFinalR: number;
                source: string;
                liveCount?: number;
                simulatedCount?: number;
              }
            >)[family];
            const ratio =
              item.overlap /
              Math.max(periodSpanDays(item.period.startDate, item.period.endDate), 1);
            count += Math.round(metric.count * ratio);
            liveCount += Math.round((metric.liveCount ?? 0) * ratio);
            simulatedCount += Math.round((metric.simulatedCount ?? 0) * ratio);
            weightedWinRate += metric.winRate * item.overlap;
            weightedFinalR += metric.avgFinalR * item.overlap;
          }

          return [
            family,
            {
              count,
              winRate: totalOverlap > 0 ? weightedWinRate / totalOverlap : 0,
              avgFinalR: totalOverlap > 0 ? weightedFinalR / totalOverlap : 0,
              source:
                liveCount > 0 && simulatedCount > 0
                  ? 'MIXED'
                  : liveCount > 0
                    ? 'LIVE'
                    : simulatedCount > 0
                      ? 'SIMULATED'
                      : 'NONE',
              liveCount,
              simulatedCount,
            },
          ];
        }),
      );

      aggregated.push({
        granularity: granularity as MarketPeriodGranularity,
        periodKey: bucket.key,
        startDate: bucket.startDate,
        endDate: bucket.endDate,
        label: pickDominantRegimeLabel(overlaps.map((item) => item.period.label)),
        liveSampleCount: overlaps.reduce((sum, item) => {
          const ratio =
            item.overlap /
            Math.max(periodSpanDays(item.period.startDate, item.period.endDate), 1);
          return sum + Math.round(item.period.liveSampleCount * ratio);
        }, 0),
        simulatedSampleCount: overlaps.reduce((sum, item) => {
          const ratio =
            item.overlap /
            Math.max(periodSpanDays(item.period.startDate, item.period.endDate), 1);
          return sum + Math.round(item.period.simulatedSampleCount * ratio);
        }, 0),
        sourcePeriodCount: overlaps.length,
        scorecard: weightedScorecard,
        proxyStates: latestPeriod.proxyStates,
      });
    }

    return aggregated;
  }

  private async buildLeaderSnapshots(
    startDate: Date,
    endDate: Date,
  ): Promise<LeaderSnapshotBuildResult> {
    const activeStockRows = await this.prisma.stockDaily.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { stockId: true },
      distinct: ['stockId'],
    });
    const activeStockIds = activeStockRows.map((row) => row.stockId);
    if (activeStockIds.length === 0) {
      return { summary: [], snapshots: [] };
    }

    const runs = await this.prisma.leaderRun.findMany({
      where: {
        isQualified: true,
        stage2StartDate: { lte: endDate },
        stockId: { in: activeStockIds },
      },
      include: {
        stock: {
          select: {
            id: true,
            ticker: true,
            name: true,
          },
        },
      },
      orderBy: [{ peakGainPct: 'desc' }, { stage2EndDate: 'desc' }],
      take: 40,
    });

    const stockIds = [...new Set(runs.map((run) => run.stockId))];
    if (stockIds.length === 0) {
      return { summary: [], snapshots: [] };
    }
    const [stages, setups, timingSignals, bars] = await Promise.all([
      this.prisma.stockStage.findMany({
        where: {
          stockId: { in: stockIds },
          date: { lte: endDate },
        },
        orderBy: [{ stockId: 'asc' }, { date: 'desc' }],
      }),
      this.prisma.setup.findMany({
        where: {
          stockId: { in: stockIds },
          timeframe: 'DAILY',
          detectedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ detectedAt: 'desc' }],
        select: {
          stockId: true,
          type: true,
          state: true,
          direction: true,
          detectedAt: true,
        },
      }),
      this.prisma.intradayTimingSignal.findMany({
        where: {
          stockId: { in: stockIds },
          signalAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ signalAt: 'desc' }],
        select: {
          stockId: true,
          type: true,
          direction: true,
          signalAt: true,
          levelType: true,
          referenceLevel: true,
          triggerPrice: true,
          stopPrice: true,
        },
      }),
      this.prisma.stockDaily.findMany({
        where: {
          stockId: { in: stockIds },
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ stockId: 'asc' }, { date: 'asc' }],
        select: {
          stockId: true,
          close: true,
        },
      }),
    ]);
    const stagesByStock = this.groupBy(stages, (item) => item.stockId);
    const setupsByStock = this.groupBy(setups, (item) => item.stockId);
    const timingByStock = this.groupBy(timingSignals, (item) => item.stockId);
    const barsByStock = this.groupBy(bars, (item) => item.stockId);

    const summaries = runs.map((run) => {
        const stockStages = stagesByStock.get(run.stockId) ?? [];
        const stageAtStart =
          stockStages.find((row) => row.date.getTime() <= startDate.getTime()) ?? null;
        const stageAtEnd =
          stockStages.find((row) => row.date.getTime() <= endDate.getTime()) ?? null;
        const stockSetups = (setupsByStock.get(run.stockId) ?? [])
          .slice(0, 8)
          .map((setup) => ({
            type: setup.type,
            state: setup.state,
            direction: setup.direction,
            detectedAt: setup.detectedAt.toISOString(),
          }));
        const stockSignals = (timingByStock.get(run.stockId) ?? [])
          .slice(0, 10)
          .map((signal) => ({
            type: signal.type,
            direction: signal.direction,
            signalAt: signal.signalAt.toISOString(),
            levelType: signal.levelType,
            referenceLevel: Number(signal.referenceLevel),
            triggerPrice: signal.triggerPrice != null ? Number(signal.triggerPrice) : null,
            stopPrice: signal.stopPrice != null ? Number(signal.stopPrice) : null,
          }));
        const stockBars = barsByStock.get(run.stockId) ?? [];

        const periodStartClose = stockBars[0] ? Number(stockBars[0].close) : null;
        const periodEndClose = stockBars[stockBars.length - 1]
          ? Number(stockBars[stockBars.length - 1].close)
          : null;
        const periodReturnPct =
          periodStartClose != null && periodEndClose != null && periodStartClose > 0
            ? ((periodEndClose - periodStartClose) / periodStartClose) * 100
            : null;
        const shortingEnabled =
          run.isQualified &&
          (stageAtEnd?.stage === StageEnum.STAGE_3 ||
            stageAtEnd?.stage === StageEnum.STAGE_4);
        const primarySetup = stockSetups[0] ?? null;
        const activity = deriveLeaderPeriodActivity({
          stageAtPeriodEnd: stageAtEnd?.stage ?? null,
          primarySetupType: primarySetup?.type ?? null,
          shortingEnabled,
          periodReturnPct,
          setupCount: stockSetups.length,
        });

        const summary: LeaderPeriodSummary = {
          ticker: run.stock.ticker,
          name: run.stock.name,
          stage2StartDate: run.stage2StartDate,
          stage2EndDate: run.stage2EndDate,
          peakGainPct: Number(run.peakGainPct),
          entryPrice: Number(run.entryPrice),
          peakPrice: Number(run.peakPrice),
          stageAtPeriodStart: stageAtStart?.stage ?? null,
          stageAtPeriodEnd: stageAtEnd?.stage ?? null,
          activity: activity.activity,
          activityNote: activity.note,
          identifiedSetupLabel: this.formatIdentifiedSetupLabel(primarySetup),
          activeSetups: stockSetups,
          primarySetup,
          timingSignals: stockSignals,
          periodStartClose,
          periodEndClose,
          periodReturnPct,
          shortingEnabled,
        };

        const sortScore =
          (shortingEnabled ? 50 : 0) +
          (stockSetups.length > 0 ? 20 : 0) +
          (stockSignals.length > 0 ? 8 : 0) +
          (stageAtEnd?.stage === StageEnum.STAGE_2 ? 12 : 0) +
          (periodReturnPct ?? 0) / 5 +
          Number(run.peakGainPct) / 20;

        return {
          runId: run.id,
          stockId: run.stockId,
          summary,
          sortScore,
        };
      });

    const top = summaries
      .sort((a, b) => b.sortScore - a.sortScore)
      .slice(0, 10);

    return {
      summary: top.map((item) => item.summary),
      snapshots: top.map((item) => ({
        leaderRunId: item.runId,
        stockId: item.stockId,
        periodStartDate: startDate,
        periodEndDate: endDate,
        stageAtPeriodStart: item.summary.stageAtPeriodStart,
        stageAtPeriodEnd: item.summary.stageAtPeriodEnd,
        activity: item.summary.activity,
        activityNote: item.summary.activityNote,
        identifiedSetupLabel: item.summary.identifiedSetupLabel,
        primarySetupType: item.summary.primarySetup?.type ?? null,
        primarySetupDirection: item.summary.primarySetup?.direction ?? null,
        primarySetupState: item.summary.primarySetup?.state ?? null,
        setupCount: item.summary.activeSetups.length,
        activeSetups: this.toInputJson(item.summary.activeSetups),
        timingSignalCount: item.summary.timingSignals.length,
        timingSignals: this.toInputJson(item.summary.timingSignals),
        startClose: item.summary.periodStartClose,
        endClose: item.summary.periodEndClose,
        periodReturnPct: item.summary.periodReturnPct,
        shortingEnabled: item.summary.shortingEnabled,
      })),
    };
  }

  private renderPeriodMarkdown(period: {
    granularity?: MarketPeriodGranularity;
    startDate: Date;
    endDate: Date;
    label: MarketRegimeLabel;
    liveSampleCount: number;
    simulatedSampleCount: number;
    scorecard: Record<string, unknown>;
    proxyStates: ProxyStateSummary[];
    leaderSummary: LeaderMarkdownSummary[];
  }): string {
    const proxyLines = period.proxyStates
      .map(
        (proxy) =>
          `- ${proxy.ticker}: ${proxy.trend} / ${proxy.stage} / ${proxy.dominantSetup ?? 'NO_SETUP'}`,
      )
      .join('\n');

    const leaderLines = period.leaderSummary
      .map(
        (leader) =>
          `- ${leader.ticker}: ${leader.identifiedSetupLabel ?? leader.activity ?? 'QUIET'} / peak ${Number(leader.peakGainPct).toFixed(1)}% / stage ${leader.stageAtPeriodEnd ?? 'N/A'} / shorting ${leader.shortingEnabled ? 'enabled' : 'disabled'}`,
      )
      .join('\n');

    return [
      `## ${period.startDate.toISOString().slice(0, 10)} to ${period.endDate.toISOString().slice(0, 10)} - ${period.label} (${period.granularity ?? MarketPeriodGranularity.REGIME})`,
      '',
      `Live samples: ${period.liveSampleCount} | Simulated samples: ${period.simulatedSampleCount}`,
      '',
      '### Proxies',
      proxyLines || '- None',
      '',
      '### Leaders',
      leaderLines || '- None',
      '',
      '### Scorecard',
      '```json',
      JSON.stringify(period.scorecard, null, 2),
      '```',
      '',
    ].join('\n');
  }

  private buildPeriodKey(
    granularity: MarketPeriodGranularity,
    startDate: Date,
    endDate: Date,
    ordinal = 0,
  ): string {
    if (granularity === MarketPeriodGranularity.MONTH) {
      return `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    if (granularity === MarketPeriodGranularity.YEAR) {
      return `${startDate.getUTCFullYear()}`;
    }

    return `${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}_${ordinal}`;
  }

  private formatIdentifiedSetupLabel(setup: SetupSummary | null): string | null {
    if (!setup) {
      return null;
    }

    const setupLabel = setup.type
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
    const stateLabel = setup.state.charAt(0) + setup.state.slice(1).toLowerCase();

    return `${setupLabel} ${stateLabel} / ${setup.direction}`;
  }

  private asDateOnly(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toObjectRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private parseProxyStates(value: unknown): ProxyStateSummary[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.parseProxyState(item))
      .filter((item): item is ProxyStateSummary => item != null);
  }

  private parseProxyState(value: unknown): ProxyStateSummary | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const row = value as Record<string, unknown>;
    if (
      typeof row.ticker !== 'string' ||
      !this.isStageEnum(row.stage) ||
      !this.isMarketTrendLabel(row.trend)
    ) {
      return null;
    }

    return {
      ticker: row.ticker,
      stage: row.stage,
      trend: row.trend,
      dominantFamily: this.isSetupFamily(row.dominantFamily) ? row.dominantFamily : null,
      dominantSetup: this.isSetupType(row.dominantSetup) ? row.dominantSetup : null,
      close: this.toNumber(row.close),
    };
  }

  private parseLeaderSummary(value: unknown): LeaderMarkdownSummary[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.parseLeaderSummaryRow(item))
      .filter((item): item is LeaderMarkdownSummary => item != null);
  }

  private parseLeaderSummaryRow(value: unknown): LeaderMarkdownSummary | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const row = value as Record<string, unknown>;
    if (typeof row.ticker !== 'string') {
      return null;
    }

    return {
      ticker: row.ticker,
      identifiedSetupLabel:
        typeof row.identifiedSetupLabel === 'string' ? row.identifiedSetupLabel : null,
      activity: this.isLeaderPeriodActivity(row.activity) ? row.activity : null,
      peakGainPct: this.toNumber(row.peakGainPct),
      stageAtPeriodEnd: this.isStageEnum(row.stageAtPeriodEnd) ? row.stageAtPeriodEnd : null,
      shortingEnabled: Boolean(row.shortingEnabled),
    };
  }

  private toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number(value ?? 0) || 0;
  }

  private isSetupFamily(value: unknown): value is SetupFamily {
    return Object.values(SetupFamily).includes(value as SetupFamily);
  }

  private isSetupType(value: unknown): value is SetupType {
    return Object.values(SetupType).includes(value as SetupType);
  }

  private isStageEnum(value: unknown): value is StageEnum {
    return Object.values(StageEnum).includes(value as StageEnum);
  }

  private isMarketTrendLabel(value: unknown): value is MarketTrendLabel {
    return Object.values(MarketTrendLabel).includes(value as MarketTrendLabel);
  }

  private isLeaderPeriodActivity(value: unknown): value is LeaderPeriodActivity {
    return Object.values(LeaderPeriodActivity).includes(value as LeaderPeriodActivity);
  }

  private groupBy<TItem, TKey extends string>(
    items: TItem[],
    getKey: (item: TItem) => TKey,
  ): Map<TKey, TItem[]> {
    const grouped = new Map<TKey, TItem[]>();
    for (const item of items) {
      const key = getKey(item);
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }
    return grouped;
  }

  private async createManyInChunks<T>(
    rows: T[],
    writer: (rows: T[]) => Promise<unknown>,
    chunkSize = 500,
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await writer(chunk);
    }
  }

  private async runWithConcurrency<TInput, TResult>(
    items: TInput[],
    concurrency: number,
    worker: (item: TInput) => Promise<TResult>,
  ): Promise<TResult[]> {
    const results: TResult[] = [];
    let index = 0;

    const consume = async () => {
      while (index < items.length) {
        const current = items[index];
        index++;
        results.push(await worker(current));
      }
    };

    const workers = Array.from(
      { length: Math.max(1, Math.min(concurrency, items.length)) },
      () => consume(),
    );
    await Promise.all(workers);
    return results;
  }

  private async runRebuildStep<TResult>(
    step: string,
    work: () => Promise<TResult>,
  ): Promise<TResult> {
    const startedAt = Date.now();
    try {
      const result = await work();
      this.logger.log(
        `[market-rebuild] ${step} finished in ${Date.now() - startedAt}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[market-rebuild] ${step} failed after ${Date.now() - startedAt}ms`,
      );
      throw error;
    }
  }

  private async verifyRebuildSchema(): Promise<void> {
    const existingTables = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'MarketRegimePeriod',
          'MarketLeaderPeriodSnapshot',
          'MarketProxySnapshot',
          'LeaderRun',
          'SetupOutcome',
          'IntradayTimingSignal'
        )
    `;

    const existingColumns = await this.prisma.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'MarketRegimePeriod' AND column_name IN ('granularity', 'periodKey', 'sourcePeriodCount'))
          OR (table_name = 'MarketLeaderPeriodSnapshot' AND column_name = 'identifiedSetupLabel')
        )
    `;

    const requiredTables = [
      'MarketRegimePeriod',
      'MarketLeaderPeriodSnapshot',
      'MarketProxySnapshot',
      'LeaderRun',
      'SetupOutcome',
      'IntradayTimingSignal',
    ];
    const tableLookup = new Set(existingTables.map((row) => row.table_name));
    const missingTables = requiredTables.filter((table) => !tableLookup.has(table));

    const lookup = new Set(existingColumns.map((row) => `${row.table_name}.${row.column_name}`));
    const required = [
      'MarketRegimePeriod.granularity',
      'MarketRegimePeriod.periodKey',
      'MarketRegimePeriod.sourcePeriodCount',
      'MarketLeaderPeriodSnapshot.identifiedSetupLabel',
    ];

    const missing = required.filter((key) => !lookup.has(key));
    if (missingTables.length > 0 || missing.length > 0) {
      const missingTablesLabel =
        missingTables.length > 0 ? `tables (${missingTables.join(', ')})` : '';
      const missingColumnsLabel =
        missing.length > 0 ? `columns (${missing.join(', ')})` : '';
      const detail = [missingTablesLabel, missingColumnsLabel]
        .filter(Boolean)
        .join(', ');
      throw new Error(
        `Market rebuild blocked: missing migrated ${detail}. Run \`npx prisma migrate dev\` and retry.`,
      );
    }
  }
}
