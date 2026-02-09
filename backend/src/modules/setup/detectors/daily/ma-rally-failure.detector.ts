import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import {
  SwingPointResult,
  priceEfficiency,
  classifyVolume,
  emaGapSeries,
  isConverging,
} from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Type B: MA Rally Failure SHORT (post-failure)
 *
 * Structure-gated MA setup: a weak rally into SMA50 or EMA20
 * acts as resistance after a base failure.
 *
 * Gating:
 *   - regime === 'FAILURE'
 *
 * Weak rally filter (at least 1):
 *   - priceEfficiency(last 10) < 0.35
 *   - EMA gap not re-expanding
 *   - Volume is CONTRACTION or NORMAL during rally
 *
 * Variant 1 -- SMA50 resistance:
 *   - Rally high approaches SMA50: abs(high - sma50) <= 1*ATR
 *   - EMA20 < SMA50
 *   - Close still below SMA50
 *
 * Variant 2 -- EMA20 resistance:
 *   - Previously broke below EMA20
 *   - Rally approaches EMA20: abs(high - ema20) <= 1*ATR
 *   - EMA20 slope negative
 *   - Close still below EMA20
 */
export class MaRallyFailureDetector implements DailyDetector {
  type = 'MA_RALLY_FAILURE' as SetupType;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 15) return null;
    if (context.regime !== 'FAILURE') return null;

    const atr = context.atr14 ?? 0;
    if (atr <= 0) return null;
    const ema20 = context.ema20;
    const sma50 = context.sma50;
    if (ema20 == null || sma50 == null) return null;

    const latestBar = bars[bars.length - 1];

    // --- Weak rally filter (need at least 1) ---
    let weakSignals = 0;

    const eff10 = priceEfficiency(bars.slice(-10));
    if (eff10 < 0.35) weakSignals++;

    const gap = emaGapSeries(bars, 20, 50);
    if (gap.length >= 10 && !isConverging(gap, 10)) {
      // gap is not converging = re-expanding is also not happening
      // Actually for failure, if gap is converging that means rally is
      // closing the gap = weaker. If NOT converging, it's stable.
      // For our purpose: if converging OR stable, count as weak.
      weakSignals++;
    }

    const avgVol = context.avgVolume ?? 0;
    if (avgVol > 0) {
      const recentBars = bars.slice(-5);
      const noExpansion = recentBars.every(
        (b) => classifyVolume(b.volume, avgVol) !== 'EXPANSION',
      );
      if (noExpansion) weakSignals++;
    }

    if (weakSignals === 0) return null;

    // --- Variant 1: SMA50 resistance ---
    if (ema20 < sma50) {
      const distToSma50 = Math.abs(latestBar.high - sma50);
      if (distToSma50 <= 1 * atr && latestBar.close < sma50) {
        const stopPrice = sma50 + 0.5 * atr;
        const riskPerShare = stopPrice - latestBar.close;

        return {
          type: 'MA_RALLY_FAILURE' as SetupType,
          direction: 'SHORT',
          timeframe: 'DAILY',
          pivotPrice: sma50,
          stopPrice,
          targetPrice:
            riskPerShare > 0
              ? latestBar.close - riskPerShare * 3
              : undefined,
          riskReward: 3,
          evidence: [
            'regime_failure',
            'weak_rally',
            'sma50_resistance',
          ],
          metadata: {
            context: 'BASE_FAILURE',
            ma: 'SMA50',
            sma50,
            ema20,
            priceEfficiency10: Math.round(eff10 * 100) / 100,
            distToMaAtr:
              Math.round((distToSma50 / atr) * 100) / 100,
            atrUsed: atr,
          },
        };
      }
    }

    // --- Variant 2: EMA20 resistance ---
    // EMA20 slope negative: check if ema20 value is below close from 10 bars ago
    // (proxy since we only have latest ema20 value)
    const ema20SlopeNegative =
      bars.length >= 10 && ema20 < bars[bars.length - 10].close;

    if (ema20SlopeNegative) {
      const distToEma20 = Math.abs(latestBar.high - ema20);
      if (distToEma20 <= 1 * atr && latestBar.close < ema20) {
        const stopPrice = ema20 + 0.5 * atr;
        const riskPerShare = stopPrice - latestBar.close;

        return {
          type: 'MA_RALLY_FAILURE' as SetupType,
          direction: 'SHORT',
          timeframe: 'DAILY',
          pivotPrice: ema20,
          stopPrice,
          targetPrice:
            riskPerShare > 0
              ? latestBar.close - riskPerShare * 3
              : undefined,
          riskReward: 3,
          evidence: [
            'regime_failure',
            'weak_rally',
            'ema20_resistance',
            'ema20_slope_negative',
          ],
          metadata: {
            context: 'BASE_FAILURE',
            ma: 'EMA20',
            ema20,
            sma50,
            priceEfficiency10: Math.round(eff10 * 100) / 100,
            distToMaAtr:
              Math.round((distToEma20 / atr) * 100) / 100,
            atrUsed: atr,
          },
        };
      }
    }

    return null;
  }
}
