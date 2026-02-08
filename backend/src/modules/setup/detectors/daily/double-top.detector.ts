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
 * Price approaches Swing High within ABS tolerance, fails to break above.
 */
export class DoubleTopDetector implements DailyDetector {
  type = SetupType.DOUBLE_TOP;

  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    _context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 5) return null;

    const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
    if (swingHighs.length < 2) return null;

    const abs = averageBarSize(bars);
    const latestBar = bars[bars.length - 1];

    // Find the highest recent swing high
    const targetHigh = swingHighs[swingHighs.length - 1];

    // Latest bar must have tested near the swing high but failed
    const distFromHigh = Math.abs(latestBar.high - targetHigh.price);
    if (distFromHigh > abs) return null;

    // Close must be below the high (failed to break)
    if (latestBar.close >= targetHigh.price) return null;

    // Close must show rejection (bearish candle)
    if (latestBar.close >= latestBar.open) return null;

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
      evidence: ['failed_test_of_high'],
      metadata: {
        swingHighPrice: targetHigh.price,
        testHigh: latestBar.high,
        rejectionClose: latestBar.close,
      },
    };
  }
}
