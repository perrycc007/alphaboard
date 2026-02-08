import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Breakout Detector: price breaks above VCP pivot or DailyBase pivot
 * with volume confirmation (volume > 1.5x avg).
 */
export class BreakoutDetector implements DailyDetector {
  type = SetupType.BREAKOUT_PIVOT;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 2) return null;

    const latestBar = bars[bars.length - 1];
    const avgVol = context.avgVolume ?? 0;
    const abs = averageBarSize(bars);

    // Check for VCP setups in READY state with a pivot
    const readyVcp = context.activeSetups?.find(
      (s) =>
        (s.type === SetupType.VCP || s.type === SetupType.BREAKOUT_PIVOT) &&
        s.state === 'READY' &&
        s.pivotPrice != null,
    );

    if (!readyVcp || readyVcp.pivotPrice == null) return null;

    const pivot = Number(readyVcp.pivotPrice);

    // Price must close above pivot
    if (latestBar.close <= pivot) return null;

    // Volume must be above 1.5x average
    if (avgVol > 0 && latestBar.volume < avgVol * 1.5) return null;

    const stopPrice = latestBar.low - abs;
    const riskPerShare = latestBar.close - stopPrice;

    return {
      type: SetupType.BREAKOUT_PIVOT,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice: pivot,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
      riskReward: 5,
      evidence: ['volume_expansion', 'close_above_pivot'],
      metadata: {
        breakoutClose: latestBar.close,
        volumeRatio: avgVol > 0 ? latestBar.volume / avgVol : null,
      },
    };
  }
}
