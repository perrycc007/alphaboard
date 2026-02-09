import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { detectSignificantSwingPoints } from '../../primitives';
import {
  IntradayDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Intraday Undercut & Rally Detector
 *
 * Same undercut-reclaim logic as the daily variant but with
 * tighter parameters suited for intraday bars.
 *
 * Params: left=2, right=2, promAtr=1.0, departAtr=1.5, minSwingSep=5,
 *         undercutTol=0.1*ATR, nearAtr=0.3
 */
export class IntradayUndercutRallyDetector implements IntradayDetector {
  type = SetupType.UNDERCUT_RALLY;

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

    const swingLows = swingPoints.filter((p) => p.type === 'LOW');
    if (swingLows.length === 0) return null;

    const undercutTol = 0.1 * atr;
    const nearAtr = 0.3;

    for (let k = swingLows.length - 1; k >= 0; k--) {
      const priorLow = swingLows[k];

      // H-L-H structure
      const hasHighBefore = swingPoints.some(
        (p) => p.type === 'HIGH' && p.index < priorLow.index,
      );
      const hasHighAfter = swingPoints.some(
        (p) => p.type === 'HIGH' && p.index > priorLow.index,
      );
      if (!hasHighBefore || !hasHighAfter) continue;

      const barsAfter = bars.length - 1 - priorLow.index;
      if (barsAfter < 3) continue;

      const hasUndercut = latestBar.low < priorLow.price - undercutTol;
      const nearDistance = Math.abs(latestBar.low - priorLow.price);
      const isNear = nearDistance <= nearAtr * atr;

      if (!hasUndercut && !isNear) continue;

      // TRIGGERED: undercut + intrabar reclaim
      if (hasUndercut && latestBar.high > priorLow.price) {
        const stopPrice = latestBar.low - 0.5 * atr;
        const risk = priorLow.price - stopPrice;

        return {
          type: SetupType.UNDERCUT_RALLY,
          direction: 'LONG',
          timeframe: 'INTRADAY',
          pivotPrice: priorLow.price,
          stopPrice,
          targetPrice: risk > 0 ? priorLow.price + risk * 3 : undefined,
          riskReward: 3,
          evidence: ['intraday_undercut', 'intrabar_reclaim'],
          metadata: {
            priorLowPrice: priorLow.price,
            undercutLow: latestBar.low,
            reclaimHigh: latestBar.high,
            atrUsed: atr,
            state: 'TRIGGERED',
          },
        };
      }

      // READY: undercut but no reclaim yet
      if (hasUndercut) {
        return {
          type: SetupType.UNDERCUT_RALLY,
          direction: 'LONG',
          timeframe: 'INTRADAY',
          pivotPrice: priorLow.price,
          stopPrice: latestBar.low - 0.5 * atr,
          evidence: ['intraday_undercut'],
          waitingFor: 'intrabar_reclaim',
          metadata: {
            priorLowPrice: priorLow.price,
            undercutLow: latestBar.low,
            atrUsed: atr,
            state: 'READY',
          },
        };
      }

      // BUILDING: approaching
      return {
        type: SetupType.UNDERCUT_RALLY,
        direction: 'LONG',
        timeframe: 'INTRADAY',
        pivotPrice: priorLow.price,
        stopPrice: priorLow.price - 0.5 * atr,
        evidence: ['intraday_approaching_prior_low'],
        waitingFor: 'undercut_below_prior_low',
        metadata: {
          priorLowPrice: priorLow.price,
          nearCrossDistance: nearDistance,
          atrUsed: atr,
          state: 'BUILDING',
        },
      };
    }

    return null;
  }
}
