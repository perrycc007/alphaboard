import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Double Top Detector
 *
 * Detects when price approaches a significant swing high resistance level
 * after a sudden rise, but fails to break above it.
 *
 * Criteria:
 *  1. Stage 2 required
 *  2. At least 2 swing highs
 *  3. Swing high must be "significant" — price departed below
 *     (swingHigh - 2.5*ATR) within 10 bars after the high was set
 *  4. Current approach must be "sudden" — price was below
 *     (swingHigh - 2.5*ATR) and reached within 1*ATR in the last 7 bars
 *  5. Latest bar high within 1 ABS of swing high (proximity test)
 *  6. Close below swing high (failed to break)
 *  7. Direction = SHORT, pivot = swing high level
 */
export class DoubleTopDetector implements DailyDetector {
  type = SetupType.DOUBLE_TOP;

  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (!context.isStage2) return null;
    if (bars.length < 20) return null;

    const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
    if (swingHighs.length < 2) return null;

    const abs = averageBarSize(bars);
    const atr = context.atr14 ?? abs; // fall back to ABS if no ATR
    const latestBar = bars[bars.length - 1];

    // Use the most recent swing high
    const targetHigh = swingHighs[swingHighs.length - 1];

    // --- SIGNIFICANCE CHECK ---
    // In the 10 bars after the swing high, at least one bar's high must be
    // below (swingHigh - 2.5 * ATR), proving the high was meaningful resistance
    const sigLookEnd = Math.min(targetHigh.index + 11, bars.length);
    let isSignificant = false;
    for (let j = targetHigh.index + 1; j < sigLookEnd; j++) {
      if (bars[j].high < targetHigh.price - 2.5 * atr) {
        isSignificant = true;
        break;
      }
    }
    if (!isSignificant) return null;

    // --- SUDDEN RISE CHECK ---
    // Within the last 7 bars, at least one bar had its high below
    // (swingHigh - 2.5*ATR), AND the latest bar's high is within 1*ATR
    // of the swing high — i.e. a fast approach to resistance
    const recentStart = Math.max(0, bars.length - 7);
    let wasFarBelow = false;
    for (let j = recentStart; j < bars.length - 1; j++) {
      if (bars[j].high < targetHigh.price - 2.5 * atr) {
        wasFarBelow = true;
        break;
      }
    }
    if (!wasFarBelow) return null;

    const nowNearHigh = latestBar.high >= targetHigh.price - 1 * atr;
    if (!nowNearHigh) return null;

    // --- PROXIMITY: latest bar high within 1 ABS of swing high ---
    const distFromHigh = Math.abs(latestBar.high - targetHigh.price);
    if (distFromHigh > abs) return null;

    // --- FAILED BREAK: close must be below the swing high ---
    if (latestBar.close >= targetHigh.price) return null;

    const stopPrice = targetHigh.price + abs;
    const riskPerShare = stopPrice - latestBar.close;

    return {
      type: SetupType.DOUBLE_TOP,
      direction: 'SHORT',
      timeframe: 'DAILY',
      pivotPrice: targetHigh.price,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close - riskPerShare * 3 : undefined,
      riskReward: 3,
      evidence: ['significant_swing_high', 'sudden_rise', 'failed_test_of_high'],
      metadata: {
        swingHighPrice: targetHigh.price,
        testHigh: latestBar.high,
        rejectionClose: latestBar.close,
        atrUsed: atr,
      },
    };
  }
}
