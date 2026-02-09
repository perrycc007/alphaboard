import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, detectFractalPivots } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * VCP Detector (Volatility Contraction Pattern)
 * ref: fail-break-fail-base.md section 1
 *
 * Pre-condition: a DailyBase exists (COMPLETE status)
 * Detect contraction cycles:
 *   Cycle A: A_high -> A_low -> A_range
 *   Cycle B: B_high -> B_low -> B_range
 *   Contraction: B_range >= 1/3 * A_range AND B_range <= 2/3 * A_range
 * Minimum 2 cycles, optional 3rd scored higher
 * Pivot = last contraction cycle's swing high
 */
export class VcpDetector implements DailyDetector {
  type = SetupType.VCP;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (!context.isStage2) return null;

    const completeBases = context.activeBases?.filter(
      (b) => b.status === 'COMPLETE',
    );
    if (!completeBases || completeBases.length === 0) return null;

    const base = completeBases[completeBases.length - 1];
    const baseStartIdx = bars.findIndex(
      (b) => b.high >= base.peakPrice * 0.98,
    );
    if (baseStartIdx < 0) return null;

    const baseBars = bars.slice(baseStartIdx);
    if (baseBars.length < 20) return null;

    // Detect swing points within the base
    const baseSwings = detectFractalPivots(baseBars, 5);
    const highs = baseSwings.filter((s) => s.type === 'HIGH');
    const lows = baseSwings.filter((s) => s.type === 'LOW');

    if (highs.length < 2 || lows.length < 2) return null;

    // Build contraction cycles
    const cycles: Array<{ high: number; low: number; range: number }> = [];
    const pairCount = Math.min(highs.length, lows.length);

    for (let i = 0; i < pairCount; i++) {
      const h = highs[i].price;
      const l = lows[i].price;
      cycles.push({ high: h, low: l, range: h - l });
    }

    if (cycles.length < 2) return null;

    // Check contraction between consecutive cycles
    let validContractions = 0;
    for (let i = 1; i < cycles.length; i++) {
      const prevRange = cycles[i - 1].range;
      const currRange = cycles[i].range;
      if (
        currRange >= prevRange * (1 / 3) &&
        currRange <= prevRange * (2 / 3)
      ) {
        validContractions++;
      }
    }

    if (validContractions === 0) return null;

    const pivotPrice = cycles[cycles.length - 1].high;
    const latestBar = bars[bars.length - 1];

    // Pivot must be within 8% of current price
    const pivotPct =
      ((pivotPrice - latestBar.close) / latestBar.close) * 100;
    if (pivotPct > 8 || pivotPct < -8) return null;

    const stopPrice = cycles[cycles.length - 1].low;
    const riskPerShare = pivotPrice - stopPrice;

    // Volume contraction check
    const recentVolumes = baseBars.slice(-10).map((b) => b.volume);
    const earlyVolumes = baseBars.slice(0, 10).map((b) => b.volume);
    const avgRecent =
      recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const avgEarly =
      earlyVolumes.reduce((a, b) => a + b, 0) / earlyVolumes.length;
    const volumeDrying = avgRecent < avgEarly * 0.8;

    return {
      type: SetupType.VCP,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? pivotPrice + riskPerShare * 5 : undefined,
      riskReward: 5,
      metadata: {
        cycles: cycles.map((c) => ({
          high: c.high,
          low: c.low,
          range: Math.round(c.range * 100) / 100,
        })),
        contractionRatio:
          cycles.length > 1
            ? Math.round(
                (cycles[cycles.length - 1].range / cycles[0].range) * 100,
              ) / 100
            : null,
        volumeDrying,
        validContractions,
      },
      dailyBaseId: base.id,
    };
  }
}
