import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, averageBarSize } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * High Tight Flag Detector (renamed from Momentum Continuation)
 *
 * Criteria:
 *  1. Stage 2 required
 *  2. 100% rise in 42 bars
 *  3. Retrace <= 20% from peak
 *  4. Pivot (peak) within 5% of current price
 *  5. Volume contraction: retrace-phase avg volume at least 40% less
 *     than advance-phase avg volume
 */
export class HighTightFlagDetector implements DailyDetector {
  type = SetupType.HIGH_TIGHT_FLAG;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (!context.isStage2) return null;
    if (bars.length < 42) return null;

    const recent = bars.slice(-42);
    const startPrice = recent[0].close;
    const peak = Math.max(...recent.map((b) => b.high));

    // Must have risen at least 100%
    if (peak < startPrice * 2) return null;

    const latestBar = bars[bars.length - 1];
    const retrace = (peak - latestBar.close) / peak;

    // Retrace must be <= 20%
    if (retrace > 0.2) return null;

    // Pivot (peak) must be within 5% of current price
    const pivotPct = ((peak - latestBar.close) / latestBar.close) * 100;
    if (pivotPct > 5) return null;

    // --- VOLUME CONTRACTION CHECK ---
    // Split the 42-bar window at the peak bar.
    // Retrace avg volume must be <= 60% of advance avg volume (40% less).
    const peakIndex = recent.findIndex((b) => b.high === peak);
    const advanceBars = recent.slice(0, peakIndex + 1);
    const retraceBars = recent.slice(peakIndex + 1);
    if (retraceBars.length === 0) return null;

    const advanceAvgVol =
      advanceBars.reduce((sum, b) => sum + b.volume, 0) / advanceBars.length;
    const retraceAvgVol =
      retraceBars.reduce((sum, b) => sum + b.volume, 0) / retraceBars.length;

    if (advanceAvgVol <= 0) return null;
    if (retraceAvgVol > advanceAvgVol * 0.6) return null;

    const abs = averageBarSize(bars);
    const stopPrice = latestBar.low - abs;
    const riskPerShare = latestBar.close - stopPrice;

    return {
      type: SetupType.HIGH_TIGHT_FLAG,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice: peak,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
      riskReward: 5,
      evidence: ['100pct_rise', 'tight_retrace', 'volume_contraction'],
      metadata: {
        risePercent: Math.round(((peak - startPrice) / startPrice) * 100),
        retracePct: Math.round(retrace * 100),
        advanceAvgVol: Math.round(advanceAvgVol),
        retraceAvgVol: Math.round(retraceAvgVol),
        volContractionPct: Math.round(
          (1 - retraceAvgVol / advanceAvgVol) * 100,
        ),
      },
    };
  }
}
