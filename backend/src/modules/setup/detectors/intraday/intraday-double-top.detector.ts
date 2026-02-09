import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { detectSignificantSwingPoints } from '../../primitives';
import {
  IntradayDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Intraday Double Top / Upthrust Detector
 *
 * Same Upthrust/Failed-Breakout logic as the daily variant but with
 * tighter parameters suited for intraday bars.
 *
 * Params: left=2, right=2, promAtr=1.0, departAtr=1.5, minSwingSep=5,
 *         breakTol=0.05*ATR, nearAtr=0.3
 */
export class IntradayDoubleTopDetector implements IntradayDetector {
  type = SetupType.DOUBLE_TOP;

  detect(
    bars: Bar[],
    dailyContext: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 15) return null;

    const atr = dailyContext.atr14 ?? 0;
    if (atr <= 0) return null;

    const latestBar = bars[bars.length - 1];

    // Detect significant swings with intraday-tight params
    const swingPoints = detectSignificantSwingPoints(bars, {
      left: 2,
      right: 2,
      promAtr: 1.0,
      departAtr: 1.5,
      departLookahead: 7,
      minSwingSep: 5,
    });

    const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
    if (swingHighs.length === 0) return null;

    const breakTol = 0.05 * atr;
    const nearAtr = 0.3;
    const pullbackAtr = 1.5;

    for (let k = swingHighs.length - 1; k >= 0; k--) {
      const top1 = swingHighs[k];
      const barsAfter = bars.length - 1 - top1.index;
      if (barsAfter < 5) continue;

      // Pullback
      let pullbackLow = Infinity;
      for (let j = top1.index + 1; j < bars.length; j++) {
        if (bars[j].low < pullbackLow) pullbackLow = bars[j].low;
      }
      if (top1.price - pullbackLow < pullbackAtr * atr) continue;

      const hasLowBetween = swingPoints.some(
        (p) => p.type === 'LOW' && p.index > top1.index,
      );
      if (!hasLowBetween) continue;

      const nearDistance = Math.abs(latestBar.high - top1.price);
      const isNear = nearDistance <= nearAtr * atr;
      const hasExceeded = latestBar.high > top1.price + breakTol;

      if (!isNear && !hasExceeded) continue;

      // TRIGGERED: intrabar failure
      if (hasExceeded && latestBar.low < top1.price) {
        const stopPrice = latestBar.high + 0.5 * atr;
        const risk = stopPrice - top1.price;

        return {
          type: SetupType.DOUBLE_TOP,
          direction: 'SHORT',
          timeframe: 'INTRADAY',
          pivotPrice: top1.price,
          stopPrice,
          targetPrice: risk > 0 ? top1.price - risk * 3 : undefined,
          riskReward: 3,
          evidence: ['intraday_upthrust', 'intrabar_failure'],
          metadata: {
            top1Price: top1.price,
            top2High: latestBar.high,
            pullbackLow,
            atrUsed: atr,
            state: 'TRIGGERED',
          },
        };
      }

      // READY: exceeded but not failed yet
      if (hasExceeded) {
        return {
          type: SetupType.DOUBLE_TOP,
          direction: 'SHORT',
          timeframe: 'INTRADAY',
          pivotPrice: top1.price,
          stopPrice: latestBar.high + 0.5 * atr,
          evidence: ['intraday_upthrust', 'top2_exceeded'],
          waitingFor: 'intrabar_failure_below_top1',
          metadata: {
            top1Price: top1.price,
            top2High: latestBar.high,
            atrUsed: atr,
            state: 'READY',
          },
        };
      }

      // BUILDING
      return {
        type: SetupType.DOUBLE_TOP,
        direction: 'SHORT',
        timeframe: 'INTRADAY',
        pivotPrice: top1.price,
        stopPrice: top1.price + 0.5 * atr,
        evidence: ['intraday_approaching_top1'],
        waitingFor: 'price_exceeds_top1',
        metadata: {
          top1Price: top1.price,
          nearCrossDistance: nearDistance,
          atrUsed: atr,
          state: 'BUILDING',
        },
      };
    }

    return null;
  }
}
