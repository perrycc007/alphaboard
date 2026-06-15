import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Direction,
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
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IndicatorService } from '../data-ingestion/services/indicator.service';
import { StageClassifierService } from '../stock/services/stage-classifier.service';
import { SetupOrchestratorService } from '../setup/setup-orchestrator.service';
import { LeaderPeriodSnapshotService } from './leader-period-snapshot.service';
import { MarketPeriodAssemblerService } from './market-period-assembler.service';
import { getSetupFamily } from './setup-family';
import { detectSignificantSwingPoints } from '../setup/primitives';
import type { Bar } from '../../common/types';
import {
  classifyMarketRegime,
  extractLeaderRunsFromSeries,
} from './market-regime.helpers';
import type { PipelineStepId } from '../data-ingestion/services/pipeline-steps';
import type {
  ComputedPeriodView,
  LeaderMarkdownSummary,
  LeaderSnapshotContext,
  ProxyStateSummary,
  RegimePeriodCreateData,
  SetupOutcomeRow,
} from './market-regime.types';

const PROXY_TICKERS = ['SPY', 'RSP', 'QQQ', 'QQQE', 'IWM', 'GLD', 'UUP'] as const;
const EQUITY_PROXY_TICKERS = ['SPY', 'RSP', 'QQQ', 'QQQE', 'IWM'] as const;
const ROLLING_WINDOW_DAYS = 60;
const LEADER_RUN_STOCK_CHUNK_SIZE = 250;
const SETUP_OUTCOME_STOCK_CHUNK_SIZE = 100;
const SETUP_OUTCOME_CONCURRENCY = 4;
type MarketRebuildPipelineStep = Extract<PipelineStepId, '9a' | '9b' | '9c' | '9d'>;

@Injectable()
export class MarketRegimeService {
  private readonly logger = new Logger(MarketRegimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indicatorService: IndicatorService,
    private readonly stageClassifier: StageClassifierService,
    private readonly orchestrator: SetupOrchestratorService,
    private readonly leaderSnapshotService: LeaderPeriodSnapshotService,
    private readonly periodAssembler: MarketPeriodAssemblerService,
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

  async rebuildPipelineStep(stepId: MarketRebuildPipelineStep): Promise<number> {
    await this.verifyRebuildSchema();

    switch (stepId) {
      case '9a':
        return this.runRebuildStep('proxy snapshots', () =>
          this.rebuildProxySnapshots(),
        );
      case '9b':
        return this.runRebuildStep('leader runs', () =>
          this.rebuildLeaderRuns(),
        );
      case '9c':
        return this.runRebuildStep('setup outcomes', () =>
          this.rebuildSetupOutcomes(),
        );
      case '9d':
        return this.runRebuildStep('regime periods', () =>
          this.rebuildRegimePeriods(),
        );
    }
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

    let totalRows = 0;
    for (let i = 0; i < stocks.length; i += LEADER_RUN_STOCK_CHUNK_SIZE) {
      const stockChunk = stocks.slice(i, i + LEADER_RUN_STOCK_CHUNK_SIZE);
      const stockIds = stockChunk.map((stock) => stock.id);
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

      for (const stock of stockChunk) {
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

        for (const run of runs) {
          rows.push({
            stockId: stock.id,
            stage2StartDate: run.stage2StartDate,
            stage2EndDate: run.stage2EndDate,
            entryPrice: run.entryPrice,
            peakPrice: run.peakPrice,
            peakGainPct: run.peakGainPct,
            isQualified: run.isQualified,
          });
        }
      }

      if (rows.length > 0) {
        await this.createManyInChunks(rows, (data) =>
          this.prisma.leaderRun.createMany({ data }),
        );
        totalRows += rows.length;
      }

      this.logger.log(
        `[market-rebuild] leader runs chunk ${Math.min(i + stockChunk.length, stocks.length)}/${stocks.length}, rows=${totalRows}`,
      );
      this.logMemory('[market-rebuild] leader runs');
    }

    return totalRows;
  }

  async rebuildSetupOutcomes(): Promise<number> {
    await this.prisma.setupOutcome.deleteMany();

    const liveSetups = await this.prisma.setup.findMany({
      where: { timeframe: 'DAILY' },
      include: { stock: { select: { id: true } } },
    });

    const liveRows: SetupOutcomeRow[] = [];
    for (const setup of liveSetups) {
      const family = getSetupFamily(setup.type);
      if (!family) continue;

      const stateReason = ((setup.metadata as Record<string, unknown> | null)?.stateReason as string | undefined) ?? null;
      const isWin = stateReason === 'target_reached' ? true : stateReason === 'stop_hit_after_trigger' || stateReason === 'stop_violated' ? false : null;
      const finalR =
        isWin === true ? Number(setup.riskReward ?? 1) : isWin === false ? -1 : null;

      liveRows.push({
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
          metadata: this.toInputJson({
            setupState: setup.state,
            stateReason,
            rTargets: {},
            stopHit: {
              hit: isWin === false,
              hitDate:
                isWin === false && setup.lastStateAt
                  ? setup.lastStateAt.toISOString()
                  : null,
              daysToHit: null,
            },
          }),
      });
    }

    let outcomeCount = liveRows.length;
    if (liveRows.length > 0) {
      await this.createManyInChunks(liveRows, (data) =>
        this.prisma.setupOutcome.createMany({ data }),
      );
    }

    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { ticker: true, id: true },
    });

    for (let i = 0; i < stocks.length; i += SETUP_OUTCOME_STOCK_CHUNK_SIZE) {
      const stockChunk = stocks.slice(i, i + SETUP_OUTCOME_STOCK_CHUNK_SIZE);
      const simulatedRows = await this.runWithConcurrency(
        stockChunk,
        SETUP_OUTCOME_CONCURRENCY,
        (stock) => this.buildSimulatedOutcomeRows(stock),
      );

      const chunkRows: SetupOutcomeRow[] = [];
      for (const rows of simulatedRows) {
        for (const row of rows) {
          chunkRows.push(row);
        }
      }

      if (chunkRows.length > 0) {
        await this.createManyInChunks(chunkRows, (data) =>
          this.prisma.setupOutcome.createMany({ data }),
        );
        outcomeCount += chunkRows.length;
      }

      this.logger.log(
        `[market-rebuild] setup outcomes chunk ${Math.min(i + stockChunk.length, stocks.length)}/${stocks.length}, rows=${outcomeCount}`,
      );
      this.logMemory('[market-rebuild] setup outcomes');
    }

    return outcomeCount;
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
    const rollingMetricsByDate = this.periodAssembler.buildRollingFamilyMetricsByDate(
      dates,
      outcomes,
      ROLLING_WINDOW_DAYS,
    );
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
        this.periodAssembler.buildFamilyMetricsFromRows(outcomes, windowStart, date);
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

    const allPeriods = this.periodAssembler.assemblePeriodViews(points);
    const leaderSnapshotContext =
      await this.buildLeaderSnapshotContextForPeriods(allPeriods);
    const periodPayloads = allPeriods.map((period) => {
      const leaderData = this.leaderSnapshotService.buildFromContext(
        period.startDate,
        period.endDate,
        leaderSnapshotContext,
      );
      const markdown = this.renderPeriodMarkdown({
        ...period,
        leaderSummary: leaderData.summary,
      });

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
        leaderSummary: this.toInputJson(leaderData.summary),
        markdown,
      };

      return {
        periodKey: period.periodKey,
        granularity: period.granularity,
        periodCreateData,
        snapshots: leaderData.snapshots,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      if (periodPayloads.length > 0) {
        await this.createManyInChunks(periodPayloads, (chunk) =>
          tx.marketRegimePeriod.createMany({
            data: chunk.map((item) => item.periodCreateData),
          }),
        );
      }

      const persistedPeriods = await tx.marketRegimePeriod.findMany({
        where: {
          OR: periodPayloads.map((item) => ({
            granularity: item.granularity,
            periodKey: item.periodKey,
          })),
        },
        select: {
          id: true,
          granularity: true,
          periodKey: true,
        },
      });

      const periodIdByCompositeKey = new Map<string, string>();
      for (const period of persistedPeriods) {
        periodIdByCompositeKey.set(
          `${period.granularity}:${period.periodKey}`,
          period.id,
        );
      }

      const snapshotRows: Prisma.MarketLeaderPeriodSnapshotCreateManyInput[] = [];
      for (const payload of periodPayloads) {
        if (payload.snapshots.length === 0) {
          continue;
        }

        const periodId = periodIdByCompositeKey.get(
          `${payload.granularity}:${payload.periodKey}`,
        );
        if (!periodId) {
          this.logger.warn(
            `Skipped leader snapshot persistence for missing period key ${payload.granularity}:${payload.periodKey}`,
          );
          continue;
        }

        for (const snapshot of payload.snapshots) {
          snapshotRows.push({
            marketRegimePeriodId: periodId,
            ...snapshot,
          });
        }
      }

      if (snapshotRows.length > 0) {
        await this.createManyInChunks(snapshotRows, (chunk) =>
          tx.marketLeaderPeriodSnapshot.createMany({ data: chunk }),
        );
      }
    });

    return periodPayloads.length;
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

  private async buildLeaderSnapshotContextForPeriods(
    periods: ComputedPeriodView[],
  ): Promise<LeaderSnapshotContext> {
    if (periods.length === 0) {
      return this.createEmptyLeaderSnapshotContext();
    }

    const sorted = [...periods].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    );
    const startDate = sorted[0].startDate;
    const endDate = sorted[sorted.length - 1].endDate;
    return this.buildLeaderSnapshotContextForRange(startDate, endDate);
  }

  private async buildLeaderSnapshotContextForRange(
    startDate: Date,
    endDate: Date,
  ): Promise<LeaderSnapshotContext> {
    const bars = await this.prisma.stockDaily.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ stockId: 'asc' }, { date: 'asc' }],
      select: {
        stockId: true,
        date: true,
        close: true,
      },
    });
    if (bars.length === 0) {
      return this.createEmptyLeaderSnapshotContext();
    }

    const activeStockIds = [...new Set(bars.map((row) => row.stockId))];
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
    });
    if (runs.length === 0) {
      return this.createEmptyLeaderSnapshotContext();
    }

    const runStockIds = [...new Set(runs.map((run) => run.stockId))];
    const runStockIdSet = new Set(runStockIds);
    const [stages, setups, timingSignals] = await Promise.all([
      this.prisma.stockStage.findMany({
        where: {
          stockId: { in: runStockIds },
          date: { lte: endDate },
        },
        orderBy: [{ stockId: 'asc' }, { date: 'desc' }],
        select: {
          stockId: true,
          date: true,
          stage: true,
        },
      }),
      this.prisma.setup.findMany({
        where: {
          stockId: { in: runStockIds },
          timeframe: 'DAILY',
          detectedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ stockId: 'asc' }, { detectedAt: 'desc' }],
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
          stockId: { in: runStockIds },
          signalAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ stockId: 'asc' }, { signalAt: 'desc' }],
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
    ]);

    const barsByStock = this.groupBy(
      bars
        .filter((bar) => runStockIdSet.has(bar.stockId))
        .map((bar) => ({
          stockId: bar.stockId,
          date: bar.date,
          close: Number(bar.close),
        })),
      (item) => item.stockId,
    );

    return {
      runs,
      stagesByStock: this.groupBy(stages, (item) => item.stockId),
      setupsByStock: this.groupBy(setups, (item) => item.stockId),
      timingByStock: this.groupBy(timingSignals, (item) => item.stockId),
      barsByStock,
    };
  }

  private createEmptyLeaderSnapshotContext(): LeaderSnapshotContext {
    return {
      runs: [],
      stagesByStock: new Map(),
      setupsByStock: new Map(),
      timingByStock: new Map(),
      barsByStock: new Map(),
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

  private async buildSimulatedOutcomeRows(stock: {
    id: string;
    ticker: string;
  }): Promise<SetupOutcomeRow[]> {
    try {
      const simulated = await this.orchestrator.simulateDetection(stock.ticker);
      const rows: SetupOutcomeRow[] = [];
      for (const setup of simulated) {
        const family = getSetupFamily(setup.type);
        if (!family) continue;

        const effectiveDate = this.asDateOnly(
          new Date(setup.exitDate ?? setup.detectedAt),
        );
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
          metadata: this.toInputJson({
            state: setup.state,
            holdingDays: setup.holdingDays,
            rTargets: setup.rTargets,
            stopHit: setup.stopHit,
          }),
        });
      }
      return rows;
    } catch (error) {
      this.logger.warn(
        `Simulation outcome rebuild failed for ${stock.ticker}: ${String(error)}`,
      );
      return [];
    }
  }

  private logMemory(label: string): void {
    const usage = process.memoryUsage();
    this.logger.log(
      `${label} memory rss=${Math.round(usage.rss / 1024 / 1024)}MB heapUsed=${Math.round(usage.heapUsed / 1024 / 1024)}MB heapTotal=${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    );
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
