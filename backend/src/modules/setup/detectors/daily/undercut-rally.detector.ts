import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Undercut & Rally Detector (mirror of Double Top)
 *
 * Detects when price approaches a significant swing low support level
 * after a sudden drop, but holds above it (support holds).
 *
 * Criteria:
 *  1. NO Stage 2 requirement
 *  2. At least 2 swing lows
 *  3. Swing low must be "significant" — price departed above
 *     (swingLow + 2.5*ATR) within 10 bars after the low was set
 *  4. Current approach must be "sudden" — price was above
 *     (swingLow + 2.5*ATR) and dropped to within 1*ATR in the last 7 bars
 *  5. Latest bar low within 1 ABS of swing low (proximity test)
 *  6. Close above swing low (support held)
 *  7. Direction = LONG, pivot = swing low level
 */
export class UndercutRallyDetector implements DailyDetector {
  type = SetupType.UNDERCUT_RALLY;

  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 20) return null;

    const swingLows = swingPoints.filter((p) => p.type === 'LOW');
    if (swingLows.length < 2) return null;

    const abs = averageBarSize(bars);
    const atr = context.atr14 ?? abs; // fall back to ABS if no ATR
    const latestBar = bars[bars.length - 1];

    // Use the most recent swing low
    const targetLow = swingLows[swingLows.length - 1];

    // --- SIGNIFICANCE CHECK ---
    // In the 10 bars after the swing low, at least one bar's low must be
    // above (swingLow + 2.5 * ATR), proving the low was meaningful support
    const sigLookEnd = Math.min(targetLow.index + 11, bars.length);
    let isSignificant = false;
    for (let j = targetLow.index + 1; j < sigLookEnd; j++) {
      if (bars[j].low > targetLow.price + 2.5 * atr) {
        isSignificant = true;
        break;
      }
    }
    if (!isSignificant) return null;

    // --- SUDDEN DROP CHECK ---
    // Within the last 7 bars, at least one bar had its low above
    // (swingLow + 2.5*ATR), AND the latest bar's low is within 1*ATR
    // of the swing low — i.e. a fast drop to support
    const recentStart = Math.max(0, bars.length - 7);
    let wasFarAbove = false;
    for (let j = recentStart; j < bars.length - 1; j++) {
      if (bars[j].low > targetLow.price + 2.5 * atr) {
        wasFarAbove = true;
        break;
      }
    }
    if (!wasFarAbove) return null;

    const nowNearLow = latestBar.low <= targetLow.price + 1 * atr;
    if (!nowNearLow) return null;

    // --- PROXIMITY: latest bar low within 1 ABS of swing low ---
    const distFromLow = Math.abs(latestBar.low - targetLow.price);
    if (distFromLow > abs) return null;

    // --- HELD SUPPORT: close must be above the swing low ---
    if (latestBar.close <= targetLow.price) return null;

    const stopPrice = targetLow.price - abs;
    const riskPerShare = latestBar.close - stopPrice;

    return {
      type: SetupType.UNDERCUT_RALLY,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice: targetLow.price,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close + riskPerShare * 3 : undefined,
      riskReward: 3,
      evidence: ['significant_swing_low', 'sudden_drop', 'support_held'],
      metadata: {
        swingLowPrice: targetLow.price,
        testLow: latestBar.low,
        holdClose: latestBar.close,
        atrUsed: atr,
      },
    };
  }
}
