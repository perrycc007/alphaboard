import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Undercut & Rally Detector (Daily)
 *
 * Pattern: price drops to a significant swing low (PriorLow),
 * undercuts below it, then reclaims back above -- triggering a long
 * entry on the intrabar reclaim.
 *
 * BUILDING:
 *   1. PriorLow = significant swing low (H-L-H sequence)
 *   2. Price approaching PriorLow (within nearAtr * ATR)
 *
 * READY:
 *   Low < PriorLow - undercutTol (undercut). pivotPrice = PriorLow
 *
 * TRIGGERED:
 *   High > PriorLow after undercut (intrabar reclaim = LONG entry)
 *
 * VIOLATED:
 *   Close < PriorLow - 2*ATR (keeps breaking lower)
 */
export class UndercutRallyDetector implements DailyDetector {
  type = SetupType.UNDERCUT_RALLY;

  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 20) return null;

    const atr = context.atr14 ?? 0;
    if (atr <= 0) return null;

    const latestBar = bars[bars.length - 1];
    const swingLows = swingPoints.filter((p) => p.type === 'LOW');
    if (swingLows.length === 0) return null;

    // Parameters
    const undercutTol = 0.2 * atr;
    const nearAtr = 0.5;

    // Try each significant swing low as PriorLow, starting from most recent
    for (let k = swingLows.length - 1; k >= 0; k--) {
      const priorLow = swingLows[k];

      // Must have H-L-H structure: a swing high before AND after the low
      const hasHighBefore = swingPoints.some(
        (p) => p.type === 'HIGH' && p.index < priorLow.index,
      );
      const hasHighAfter = swingPoints.some(
        (p) => p.type === 'HIGH' && p.index > priorLow.index,
      );
      if (!hasHighBefore || !hasHighAfter) continue;

      // Must have at least a few bars since the low was set
      const barsAfter = bars.length - 1 - priorLow.index;
      if (barsAfter < 5) continue;

      // Check undercut and reclaim on the latest bar
      const hasUndercut = latestBar.low < priorLow.price - undercutTol;
      const nearDistance = Math.abs(latestBar.low - priorLow.price);
      const isNear = nearDistance <= nearAtr * atr;

      if (!hasUndercut && !isNear) continue;

      // --- State determination ---

      // TRIGGERED: Low undercut AND High reclaimed above PriorLow
      //            (intrabar reclaim on the same bar)
      if (hasUndercut && latestBar.high > priorLow.price) {
        const undercutLow = latestBar.low;
        const stopPrice = undercutLow - 0.5 * atr;
        const riskPerShare = priorLow.price - stopPrice;

        return {
          type: SetupType.UNDERCUT_RALLY,
          direction: 'LONG',
          timeframe: 'DAILY',
          pivotPrice: priorLow.price,
          stopPrice,
          targetPrice:
            riskPerShare > 0 ? priorLow.price + riskPerShare * 3 : undefined,
          riskReward: 3,
          evidence: [
            'significant_swing_low',
            'undercut_below_prior_low',
            'intrabar_reclaim',
          ],
          metadata: {
            priorLowPrice: priorLow.price,
            priorLowIndex: priorLow.index,
            undercutLow,
            reclaimHigh: latestBar.high,
            atrUsed: atr,
            state: 'TRIGGERED',
          },
        };
      }

      // READY: undercut happened but no reclaim yet
      if (hasUndercut) {
        const stopPrice = latestBar.low - 0.5 * atr;
        const riskPerShare = priorLow.price - stopPrice;

        return {
          type: SetupType.UNDERCUT_RALLY,
          direction: 'LONG',
          timeframe: 'DAILY',
          pivotPrice: priorLow.price,
          stopPrice,
          targetPrice:
            riskPerShare > 0 ? priorLow.price + riskPerShare * 3 : undefined,
          riskReward: 3,
          evidence: [
            'significant_swing_low',
            'undercut_below_prior_low',
          ],
          waitingFor: 'intrabar_reclaim_above_prior_low',
          metadata: {
            priorLowPrice: priorLow.price,
            priorLowIndex: priorLow.index,
            undercutLow: latestBar.low,
            atrUsed: atr,
            state: 'READY',
          },
        };
      }

      // BUILDING: approaching PriorLow but hasn't undercut yet
      return {
        type: SetupType.UNDERCUT_RALLY,
        direction: 'LONG',
        timeframe: 'DAILY',
        pivotPrice: priorLow.price,
        stopPrice: priorLow.price - 0.5 * atr,
        evidence: [
          'significant_swing_low',
          'approaching_prior_low',
        ],
        waitingFor: 'undercut_below_prior_low',
        metadata: {
          priorLowPrice: priorLow.price,
          priorLowIndex: priorLow.index,
          nearCrossDistance: nearDistance,
          atrUsed: atr,
          state: 'BUILDING',
        },
      };
    }

    return null;
  }
}
