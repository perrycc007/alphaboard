import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Double Top / Upthrust / Failed Breakout Detector (Daily)
 *
 * Pattern: price rises to a significant swing high (Top1), pulls back,
 * then returns and briefly exceeds Top1 (Top2) but fails, triggering
 * a short entry on the intrabar failure.
 *
 * BUILDING:
 *   1. Top1 = significant swing high (from swingPoints)
 *   2. pullbackLow = lowest low since Top1
 *   3. pullback depth >= 2.5 * ATR (meaningful)
 *   4. At least 10 bars since Top1
 *   5. Price returning toward Top1 (within nearAtr * ATR)
 *
 * READY:
 *   High > Top1 + breakTol (Top2 exceeds Top1)
 *   pivotPrice = Top1
 *
 * TRIGGERED:
 *   Low < Top1 after exceeding (intrabar failure = SHORT entry)
 *
 * VIOLATED:
 *   Close holds above Top1 + breakTol for sustained bars
 */
export class DoubleTopDetector implements DailyDetector {
  type = SetupType.DOUBLE_TOP;

  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 20) return null;

    const atr = context.atr14 ?? 0;
    if (atr <= 0) return null;

    const latestBar = bars[bars.length - 1];
    const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
    if (swingHighs.length === 0) return null;

    // Parameters
    const pullbackAtr = 2.5;
    const minBarsSince = 10;
    const breakTol = 0.1 * atr;
    const nearAtr = 0.5;

    // Try each significant swing high as Top1, starting from most recent
    for (let k = swingHighs.length - 1; k >= 0; k--) {
      const top1 = swingHighs[k];
      const barsAfterTop1 = bars.length - 1 - top1.index;
      if (barsAfterTop1 < minBarsSince) continue;

      // Pullback: lowest low since Top1
      let pullbackLow = Infinity;
      for (let j = top1.index + 1; j < bars.length; j++) {
        if (bars[j].low < pullbackLow) pullbackLow = bars[j].low;
      }
      const pullbackDepth = top1.price - pullbackLow;
      if (pullbackDepth < pullbackAtr * atr) continue;

      // Must have a swing low between Top1 and now (H-L-H structure)
      const hasLowBetween = swingPoints.some(
        (p) => p.type === 'LOW' && p.index > top1.index,
      );
      if (!hasLowBetween) continue;

      // Check if latest bar is near Top1 or has exceeded it
      const nearDistance = Math.abs(latestBar.high - top1.price);
      const isNear = nearDistance <= nearAtr * atr;
      const hasExceeded = latestBar.high > top1.price + breakTol;

      if (!isNear && !hasExceeded) continue;

      // --- State determination ---

      // TRIGGERED: High exceeded Top1 AND Low came back below Top1
      //            (intrabar failure on the same bar)
      if (hasExceeded && latestBar.low < top1.price) {
        const stopPrice = latestBar.high + 0.5 * atr;
        const riskPerShare = stopPrice - top1.price;

        return {
          type: SetupType.DOUBLE_TOP,
          direction: 'SHORT',
          timeframe: 'DAILY',
          pivotPrice: top1.price,
          stopPrice,
          targetPrice:
            riskPerShare > 0 ? top1.price - riskPerShare * 3 : undefined,
          riskReward: 3,
          evidence: [
            'significant_swing_high',
            'pullback_depth_ok',
            'upthrust_intrabar_failure',
          ],
          metadata: {
            top1Price: top1.price,
            top1Index: top1.index,
            top2High: latestBar.high,
            pullbackLow,
            pullbackDepthAtr: Math.round((pullbackDepth / atr) * 100) / 100,
            atrUsed: atr,
            state: 'TRIGGERED',
          },
        };
      }

      // READY: High exceeded Top1 but Low hasn't failed back yet
      if (hasExceeded) {
        const stopPrice = latestBar.high + 0.5 * atr;
        const riskPerShare = stopPrice - top1.price;

        return {
          type: SetupType.DOUBLE_TOP,
          direction: 'SHORT',
          timeframe: 'DAILY',
          pivotPrice: top1.price,
          stopPrice,
          targetPrice:
            riskPerShare > 0 ? top1.price - riskPerShare * 3 : undefined,
          riskReward: 3,
          evidence: [
            'significant_swing_high',
            'pullback_depth_ok',
            'top2_exceeded_top1',
          ],
          waitingFor: 'intrabar_failure_below_top1',
          metadata: {
            top1Price: top1.price,
            top1Index: top1.index,
            top2High: latestBar.high,
            pullbackLow,
            pullbackDepthAtr: Math.round((pullbackDepth / atr) * 100) / 100,
            atrUsed: atr,
            state: 'READY',
          },
        };
      }

      // BUILDING: approaching Top1 but hasn't exceeded yet
      return {
        type: SetupType.DOUBLE_TOP,
        direction: 'SHORT',
        timeframe: 'DAILY',
        pivotPrice: top1.price,
        stopPrice: top1.price + 0.5 * atr,
        evidence: [
          'significant_swing_high',
          'pullback_depth_ok',
          'approaching_top1',
        ],
        waitingFor: 'price_exceeds_top1',
        metadata: {
          top1Price: top1.price,
          top1Index: top1.index,
          nearCrossDistance: nearDistance,
          pullbackLow,
          pullbackDepthAtr: Math.round((pullbackDepth / atr) * 100) / 100,
          atrUsed: atr,
          state: 'BUILDING',
        },
      };
    }

    return null;
  }
}
