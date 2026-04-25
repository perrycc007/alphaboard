import { Injectable } from '@nestjs/common';
import { StageEnum } from '@prisma/client';
import { deriveLeaderPeriodActivity } from './market-regime.helpers';
import type {
  LeaderPeriodSummary,
  LeaderSetupRow,
  LeaderSnapshotBuildResult,
  LeaderSnapshotContext,
  LeaderTimingRow,
  SetupSummary,
  TimingSignalSummary,
} from './market-regime.types';

@Injectable()
export class LeaderPeriodSnapshotService {
  buildFromContext(
    startDate: Date,
    endDate: Date,
    context: LeaderSnapshotContext,
  ): LeaderSnapshotBuildResult {
    if (context.runs.length === 0) {
      return { summary: [], snapshots: [] };
    }

    const summaries = context.runs
      .filter((run) => run.stage2StartDate.getTime() <= endDate.getTime())
      .map((run) => {
        const stockBars = context.barsByStock.get(run.stockId) ?? [];
        const periodBars = stockBars.filter(
          (bar) =>
            bar.date.getTime() >= startDate.getTime() &&
            bar.date.getTime() <= endDate.getTime(),
        );
        if (periodBars.length === 0) {
          return null;
        }

        const stockStages = context.stagesByStock.get(run.stockId) ?? [];
        const stageAtStart =
          stockStages.find((row) => row.date.getTime() <= startDate.getTime()) ?? null;
        const stageAtEnd =
          stockStages.find((row) => row.date.getTime() <= endDate.getTime()) ?? null;
        const stockSetups = this.pickSetupsForPeriod(
          context.setupsByStock.get(run.stockId) ?? [],
          startDate,
          endDate,
        );
        const stockSignals = this.pickTimingSignalsForPeriod(
          context.timingByStock.get(run.stockId) ?? [],
          startDate,
          endDate,
        );

        const periodStartClose = periodBars[0] ? Number(periodBars[0].close) : null;
        const periodEndClose = periodBars[periodBars.length - 1]
          ? Number(periodBars[periodBars.length - 1].close)
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
      })
      .filter(
        (
          item,
        ): item is {
          runId: string;
          stockId: string;
          summary: LeaderPeriodSummary;
          sortScore: number;
        } => item != null,
      );

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

  private pickSetupsForPeriod(
    setups: LeaderSetupRow[],
    startDate: Date,
    endDate: Date,
    limit = 8,
  ): SetupSummary[] {
    const selected: SetupSummary[] = [];
    for (const setup of setups) {
      const detectedAt = setup.detectedAt.getTime();
      if (detectedAt > endDate.getTime()) continue;
      if (detectedAt < startDate.getTime()) break;
      selected.push({
        type: setup.type,
        state: setup.state,
        direction: setup.direction,
        detectedAt: setup.detectedAt.toISOString(),
      });
      if (selected.length >= limit) break;
    }
    return selected;
  }

  private pickTimingSignalsForPeriod(
    signals: LeaderTimingRow[],
    startDate: Date,
    endDate: Date,
    limit = 10,
  ): TimingSignalSummary[] {
    const selected: TimingSignalSummary[] = [];
    for (const signal of signals) {
      const signalAt = signal.signalAt.getTime();
      if (signalAt > endDate.getTime()) continue;
      if (signalAt < startDate.getTime()) break;
      selected.push({
        type: signal.type,
        direction: signal.direction,
        signalAt: signal.signalAt.toISOString(),
        levelType: signal.levelType,
        referenceLevel: Number(signal.referenceLevel),
        triggerPrice: signal.triggerPrice != null ? Number(signal.triggerPrice) : null,
        stopPrice: signal.stopPrice != null ? Number(signal.stopPrice) : null,
      });
      if (selected.length >= limit) break;
    }
    return selected;
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

  private toInputJson(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }
}
