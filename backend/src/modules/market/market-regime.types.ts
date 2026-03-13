import type {
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

export type FamilyMetric = {
  count: number;
  winRate: number;
  avgFinalR: number;
  source: 'LIVE' | 'SIMULATED' | 'MIXED' | 'NONE';
};

export type ProxyStateSummary = {
  ticker: string;
  stage: StageEnum;
  trend: MarketTrendLabel;
  dominantFamily: SetupFamily | null;
  dominantSetup: SetupType | null;
  close: number;
};

export type SetupSummary = {
  type: SetupType;
  state: SetupState;
  direction: Direction;
  detectedAt?: string;
};

export type TimingSignalSummary = {
  type: TimingSignalType;
  direction: Direction;
  signalAt: string;
  levelType: KeyLevelType;
  referenceLevel: number;
  triggerPrice: number | null;
  stopPrice: number | null;
};

export type LeaderPeriodSummary = {
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

export type LeaderMarkdownSummary = {
  ticker: string;
  identifiedSetupLabel: string | null;
  activity: LeaderPeriodActivity | null;
  peakGainPct: number;
  stageAtPeriodEnd: StageEnum | null;
  shortingEnabled: boolean;
};

export type ComputedPeriodView = {
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

export type RegimePoint = {
  date: Date;
  label: MarketRegimeLabel;
  liveSampleCount: number;
  simulatedSampleCount: number;
  scorecard: Record<string, unknown>;
  proxyStates: ProxyStateSummary[];
};

export type SetupOutcomeRow = Prisma.SetupOutcomeCreateManyInput;

export type LeaderSnapshotRow = Omit<
  Prisma.MarketLeaderPeriodSnapshotCreateManyInput,
  'marketRegimePeriodId'
>;

export type RegimePeriodCreateData = Prisma.MarketRegimePeriodCreateInput;

export interface SetupOutcomeMetricRow {
  family: SetupFamily;
  source: SetupOutcomeSource;
  isWin: boolean | null;
  finalR: Prisma.Decimal | null;
  effectiveDate: Date;
}

export type FamilyOutcomeAccumulator = {
  count: number;
  wins: number;
  finalRSum: number;
};

export type FamilySourceAccumulators = Record<
  SetupFamily,
  {
    live: FamilyOutcomeAccumulator;
    simulated: FamilyOutcomeAccumulator;
  }
>;

export interface LeaderSnapshotBuildResult {
  summary: LeaderPeriodSummary[];
  snapshots: LeaderSnapshotRow[];
}

export type LeaderRunWithStock = Prisma.LeaderRunGetPayload<{
  include: {
    stock: {
      select: {
        id: true;
        ticker: true;
        name: true;
      };
    };
  };
}>;

export type LeaderStageRow = {
  stockId: string;
  date: Date;
  stage: StageEnum;
};

export type LeaderSetupRow = {
  stockId: string;
  type: SetupType;
  state: SetupState;
  direction: Direction;
  detectedAt: Date;
};

export type LeaderTimingRow = {
  stockId: string;
  type: TimingSignalType;
  direction: Direction;
  signalAt: Date;
  levelType: KeyLevelType;
  referenceLevel: Prisma.Decimal;
  triggerPrice: Prisma.Decimal | null;
  stopPrice: Prisma.Decimal | null;
};

export type LeaderBarRow = {
  stockId: string;
  date: Date;
  close: number;
};

export interface LeaderSnapshotContext {
  runs: LeaderRunWithStock[];
  stagesByStock: Map<string, LeaderStageRow[]>;
  setupsByStock: Map<string, LeaderSetupRow[]>;
  timingByStock: Map<string, LeaderTimingRow[]>;
  barsByStock: Map<string, LeaderBarRow[]>;
}
