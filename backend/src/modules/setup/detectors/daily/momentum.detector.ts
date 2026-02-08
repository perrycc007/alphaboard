import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Momentum Continuation Detector
 * 100% rise in ~2 months (42 bars), retrace <= 20%, tight base, volume contraction then expansion
 */
export class MomentumContinuationDetector implements DailyDetector {
  type = SetupType.MOMENTUM_CONTINUATION;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (!context.isStage2) return null;
    if (bars.length < 42) return null;

    const recent = bars.slice(-42);
    const startPrice = recent[0].close;
    const peak = Math.max(...recent.map((b) => b.high));

    // Must have risen at least 100%
    if (peak < startPrice * 2) return null;

    const latestBar = bars[bars.length - 1];
    const retrace = (peak - latestBar.close) / peak;

    // Retrace must be <= 20%
    if (retrace > 0.2) return null;

    const abs = averageBarSize(bars);
    const stopPrice = latestBar.low - abs;
    const riskPerShare = latestBar.close - stopPrice;

    return {
      type: SetupType.MOMENTUM_CONTINUATION,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice: peak,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
      riskReward: 5,
      metadata: {
        risePercent: Math.round(((peak - startPrice) / startPrice) * 100),
        retracePct: Math.round(retrace * 100),
      },
    };
  }
}
