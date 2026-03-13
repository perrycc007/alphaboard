import { Injectable } from '@nestjs/common';
import {
  MarketPeriodGranularity,
  SetupFamily,
  SetupOutcomeSource,
} from '@prisma/client';
import {
  AggregatedPeriodGranularity,
  buildCalendarBuckets,
  overlapDays,
  periodSpanDays,
  pickDominantRegimeLabel,
} from './market-regime.helpers';
import type {
  ComputedPeriodView,
  FamilyMetric,
  FamilySourceAccumulators,
  RegimePoint,
  SetupOutcomeMetricRow,
} from './market-regime.types';

const LIVE_SAMPLE_THRESHOLD = 12;
const FAMILY_SAMPLE_THRESHOLD = 3;

@Injectable()
export class MarketPeriodAssemblerService {
  buildRollingFamilyMetricsByDate(
    orderedDateKeys: string[],
    rows: SetupOutcomeMetricRow[],
    rollingWindowDays: number,
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
      windowStart.setDate(windowStart.getDate() - rollingWindowDays);
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

  buildFamilyMetricsFromRows(
    rows: SetupOutcomeMetricRow[],
    windowStart: Date,
    windowEnd: Date,
  ): Record<SetupFamily, FamilyMetric & { liveCount: number; simulatedCount: number }> {
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
          (outcome) =>
            outcome.family === family && outcome.source === SetupOutcomeSource.SIMULATED,
        );
        const preferred =
          live.length >= FAMILY_SAMPLE_THRESHOLD && totalLiveCount >= LIVE_SAMPLE_THRESHOLD
            ? live
            : [...live, ...simulated];

        const winCount = preferred.filter((item) => item.isWin === true).length;
        const avgFinalR =
          preferred.length > 0
            ? preferred.reduce((sum, item) => sum + Number(item.finalR ?? 0), 0) /
              preferred.length
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
    ) as Record<SetupFamily, FamilyMetric & { liveCount: number; simulatedCount: number }>;

    return metrics;
  }

  assemblePeriodViews(points: RegimePoint[]): ComputedPeriodView[] {
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

    return [...merged, ...derivedPeriods];
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

  private asDateOnly(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private createEmptyFamilyAccumulators(): FamilySourceAccumulators {
    return {
      [SetupFamily.REVERSAL]: {
        live: { count: 0, wins: 0, finalRSum: 0 },
        simulated: { count: 0, wins: 0, finalRSum: 0 },
      },
      [SetupFamily.TREND_LONG]: {
        live: { count: 0, wins: 0, finalRSum: 0 },
        simulated: { count: 0, wins: 0, finalRSum: 0 },
      },
      [SetupFamily.TREND_SHORT]: {
        live: { count: 0, wins: 0, finalRSum: 0 },
        simulated: { count: 0, wins: 0, finalRSum: 0 },
      },
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
}
