import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Daily Base Detector (ref: setup-detector.md section 2)
 *
 * Pre-condition: stock must be Stage 2
 * - Find last Swing High as peak
 * - Scan forward >= 20 trading days
 * - Retrace = (Peak - BaseLow) / Peak <= 50%
 * - No new high during base window
 * - Output: DailyBase record with peak, low, retrace %, duration
 */
export class DailyBaseDetector implements DailyDetector {
  type = SetupType.BREAKOUT_PIVOT;

  detect(
    bars: Bar[],
    swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (!context.isStage2) return null;
    if (bars.length < 20) return null;

    const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
    if (swingHighs.length === 0) return null;

    const lastSwingHigh = swingHighs[swingHighs.length - 1];
    const peakPrice = lastSwingHigh.price;
    const peakIndex = lastSwingHigh.index;

    // Must have at least 20 bars after the peak
    const barsAfterPeak = bars.slice(peakIndex);
    if (barsAfterPeak.length < 20) return null;

    // Find lowest low in the base window
    let baseLow = Infinity;
    let hasNewHigh = false;
    const abs = averageBarSize(bars);

    for (const bar of barsAfterPeak) {
      if (bar.low < baseLow) baseLow = bar.low;
      if (bar.high > peakPrice + abs) {
        hasNewHigh = true;
        break;
      }
    }

    if (hasNewHigh) return null;
    if (baseLow === Infinity) return null;

    const retracePct = (peakPrice - baseLow) / peakPrice;
    if (retracePct > 0.5) return null; // Retrace must be <= 50%

    const durationDays = barsAfterPeak.length;

    // Find internal pivot (swing high within base)
    const baseSwingHighs = swingPoints.filter(
      (p) => p.type === 'HIGH' && p.index > peakIndex,
    );
    const pivotPrice =
      baseSwingHighs.length > 0
        ? baseSwingHighs[baseSwingHighs.length - 1].price
        : peakPrice;

    const stopPrice = baseLow - abs;
    const riskPerShare = pivotPrice - stopPrice;
    const targetPrice = pivotPrice + riskPerShare * 5; // 1:5 R:R

    return {
      type: SetupType.BREAKOUT_PIVOT,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice,
      stopPrice,
      targetPrice,
      riskReward: riskPerShare > 0 ? (targetPrice - pivotPrice) / riskPerShare : undefined,
      metadata: {
        peakPrice,
        baseLow,
        retracePct: Math.round(retracePct * 10000) / 10000,
        durationDays,
      },
    };
  }
}
