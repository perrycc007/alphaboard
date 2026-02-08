import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import {
  priceEfficiency,
  emaGapSeries,
  isConverging,
  macdHistogram,
  isHistogramContracting,
} from '../../primitives';
import {
  IntradayDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Tiring Down Detector (ref: setup-detector.md section 4)
 *
 * Pre-condition: stock = HOT / FORMER_HOT, price at intraday high zone
 * Scores 4 evidence signals (must satisfy >= 3/4):
 *   1. Higher highs with diminishing delta-high (momentum decay)
 *   2. EMA6-EMA20 gap contracting but not crossed
 *   3. MACD histogram (6,20,9) contracting but not crossed
 *   4. Price Efficiency Ratio declining vs prior window
 *
 * This is a warning/context, not an entry signal.
 */
export class TiringDownDetector implements IntradayDetector {
  type = SetupType.TIRING_DOWN;

  detect(
    bars: Bar[],
    _dailyContext: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 30) return null;

    const evidence: string[] = [];
    const lookback = 15;
    const recentBars = bars.slice(-lookback);
    const priorBars = bars.slice(-(lookback * 2), -lookback);

    // 1. Momentum decay: higher highs with diminishing delta-high
    const recentHighs: number[] = [];
    for (let i = 1; i < recentBars.length; i++) {
      if (recentBars[i].high > recentBars[i - 1].high) {
        recentHighs.push(recentBars[i].high - recentBars[i - 1].high);
      }
    }
    if (recentHighs.length >= 3) {
      let decreasingDeltas = 0;
      for (let i = 1; i < recentHighs.length; i++) {
        if (recentHighs[i] < recentHighs[i - 1]) decreasingDeltas++;
      }
      if (decreasingDeltas >= (recentHighs.length - 1) * 0.6) {
        evidence.push('momentum_decay');
      }
    }

    // 2. EMA6-EMA20 gap contracting but not crossed
    const gapSeries = emaGapSeries(bars, 6, 20);
    if (gapSeries.length >= lookback) {
      const converging = isConverging(gapSeries, lookback);
      const lastGap = gapSeries[gapSeries.length - 1];
      if (converging && lastGap > 0) {
        evidence.push('ema_compression');
      }
    }

    // 3. MACD histogram contracting but not crossed zero
    const histogram = macdHistogram(bars, 6, 20, 9);
    if (histogram.length >= lookback) {
      const contracting = isHistogramContracting(histogram, lookback);
      const lastHist = histogram[histogram.length - 1];
      if (contracting && lastHist > 0) {
        evidence.push('macd_contraction');
      }
    }

    // 4. Price efficiency declining
    if (priorBars.length > 0) {
      const priorEfficiency = priceEfficiency(priorBars);
      const recentEfficiency = priceEfficiency(recentBars);
      if (recentEfficiency < priorEfficiency * 0.7) {
        evidence.push('efficiency_decline');
      }
    }

    // Must satisfy >= 3/4 signals
    if (evidence.length < 3) return null;

    return {
      type: SetupType.TIRING_DOWN,
      direction: 'SHORT',
      timeframe: 'INTRADAY',
      evidence,
      waitingFor: '620_cross',
      metadata: {
        score: evidence.length,
        signals: evidence,
      },
    };
  }
}
