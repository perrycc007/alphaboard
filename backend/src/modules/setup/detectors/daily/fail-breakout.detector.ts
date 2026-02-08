import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Fail Breakout Detector (ref: fail-break-fail-base.md section 3)
 *
 * Pre-condition: an active VCP/BREAKOUT setup was TRIGGERED (breakout occurred)
 * Detects reversal: Close < pivot by threshold (> ABS or > 0.5%)
 * Confirmation: 2 consecutive closes below pivot, or single close with volume expansion
 * Flips direction to SHORT
 */
export class FailBreakoutDetector implements DailyDetector {
  type = SetupType.FAIL_BREAKOUT;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 3) return null;

    // Find triggered breakout setups
    const triggeredBreakout = context.activeSetups?.find(
      (s) =>
        (s.type === SetupType.BREAKOUT_PIVOT ||
          s.type === SetupType.BREAKOUT_VCB) &&
        s.state === 'TRIGGERED' &&
        s.pivotPrice != null,
    );

    if (!triggeredBreakout || triggeredBreakout.pivotPrice == null) return null;

    const pivot = Number(triggeredBreakout.pivotPrice);
    const abs = averageBarSize(bars);
    const latestBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];
    const avgVol = context.avgVolume ?? 0;

    // Close must be below pivot
    if (latestBar.close >= pivot) return null;

    const dropFromPivot = pivot - latestBar.close;
    const threshold = Math.max(abs, pivot * 0.005);

    if (dropFromPivot < threshold) return null;

    // Confirmation: 2 consecutive closes below, or single with volume expansion
    const twoConsecutive = prevBar.close < pivot && latestBar.close < pivot;
    const volumeExpansion = avgVol > 0 && latestBar.volume > avgVol * 1.5;

    if (!twoConsecutive && !volumeExpansion) return null;

    const stopPrice = pivot + abs; // Stop above pivot for short
    const riskPerShare = stopPrice - latestBar.close;

    return {
      type: SetupType.FAIL_BREAKOUT,
      direction: 'SHORT',
      timeframe: 'DAILY',
      pivotPrice: pivot,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close - riskPerShare * 5 : undefined,
      riskReward: 5,
      evidence: [
        twoConsecutive ? 'two_consecutive_below' : 'single_close_volume',
      ],
      metadata: {
        pivot,
        failureClose: latestBar.close,
        dropFromPivot: Math.round(dropFromPivot * 100) / 100,
        failureStrength: dropFromPivot / abs,
      },
    };
  }
}
