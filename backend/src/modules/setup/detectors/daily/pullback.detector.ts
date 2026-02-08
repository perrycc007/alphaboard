import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Pullback Detector
 * Price pulls back to 21EMA / 50MA on declining volume in Stage 2 stock.
 */
export class PullbackDetector implements DailyDetector {
  type = SetupType.PULLBACK_BUY;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (!context.isStage2) return null;
    if (bars.length < 5) return null;
    if (!context.sma50) return null;

    const latestBar = bars[bars.length - 1];
    const sma50 = context.sma50;
    const abs = averageBarSize(bars);

    // Price must be near the 50MA (within 1 ABS)
    const distToMa = Math.abs(latestBar.close - sma50);
    if (distToMa > abs) return null;

    // Volume should be declining over last 3 bars
    const recentVolumes = bars.slice(-3).map((b) => b.volume);
    const isVolumeDecline =
      recentVolumes[0] > recentVolumes[1] &&
      recentVolumes[1] > recentVolumes[2];
    if (!isVolumeDecline) return null;

    const stopPrice = Math.min(
      ...bars.slice(-5).map((b) => b.low),
    ) - abs;

    const riskPerShare = latestBar.close - stopPrice;

    return {
      type: SetupType.PULLBACK_BUY,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice: latestBar.close,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
      riskReward: 5,
      metadata: {
        maLevel: sma50,
        distanceToMa: Math.round(distToMa * 100) / 100,
      },
    };
  }
}
