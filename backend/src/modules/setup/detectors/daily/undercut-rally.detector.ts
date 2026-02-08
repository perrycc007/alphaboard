import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Undercut & Rally Detector
 * Price undercuts a Swing Low then reclaims it (from swing-point primitives).
 */
export class UndercutRallyDetector implements DailyDetector {
  type = SetupType.UNDERCUT_RALLY;

  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    _context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 5) return null;

    const swingLows = swingPoints.filter((p) => p.type === 'LOW');
    if (swingLows.length === 0) return null;

    const abs = averageBarSize(bars);
    const latestBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];

    // Find the most recent swing low
    const recentSwingLow = swingLows[swingLows.length - 1];
    const swingLowPrice = recentSwingLow.price;

    // Previous bar must have undercut the swing low
    if (prevBar.low >= swingLowPrice) return null;

    // Current bar must close above the swing low (reclaim)
    if (latestBar.close <= swingLowPrice) return null;

    const stopPrice = prevBar.low - abs;
    const riskPerShare = latestBar.close - stopPrice;

    return {
      type: SetupType.UNDERCUT_RALLY,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice: swingLowPrice,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
      riskReward: 5,
      evidence: ['undercut_reclaim'],
      metadata: {
        swingLowPrice,
        undercutLow: prevBar.low,
        reclaimClose: latestBar.close,
      },
    };
  }
}
