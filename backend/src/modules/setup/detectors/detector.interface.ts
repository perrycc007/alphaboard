import { SetupType, Direction, Timeframe } from '@prisma/client';
import { Bar } from '../../../common/types';
import { SwingPointResult } from '../primitives';

export interface DetectedSetup {
  type: SetupType;
  direction: Direction;
  timeframe: Timeframe;
  pivotPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  riskReward?: number;
  evidence?: string[];
  waitingFor?: string;
  metadata?: Record<string, unknown>;
  dailyBaseId?: string;
}

export interface DailyDetector {
  type: SetupType;
  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null;
}

export interface DailyDetectorContext {
  stockId: string;
  isStage2: boolean;
  sma50?: number;
  sma200?: number;
  avgVolume?: number;
  dailyBaseId?: string;
  activeBases?: Array<{
    id: string;
    peakPrice: number;
    baseLow: number;
    pivotPrice?: number;
    status: string;
  }>;
  activeSetups?: Array<{
    id: string;
    type: SetupType;
    state: string;
    pivotPrice?: number;
  }>;
}

export interface IntradayDetector {
  type: SetupType;
  detect(
    bars: Bar[],
    dailyContext: DailyDetectorContext,
  ): DetectedSetup | null;
  updateState?(
    currentState: string,
    latestBar: Bar,
    context: DailyDetectorContext,
  ): string;
}
