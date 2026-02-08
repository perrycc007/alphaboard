import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import {
  IntradayDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Cross 620 Detector (execution trigger)
 *
 * Pre-condition: must have an existing intraday base or daily setup at key level.
 * 6 SMA crosses 20 SMA on 5-min chart.
 * Long: fast crosses above slow
 * Short: fast crosses below slow
 * Transitions parent setup to TRIGGERED.
 */
export class Cross620Detector implements IntradayDetector {
  type = SetupType.CROSS_620;

  detect(
    bars: Bar[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 2) return null;

    // Must have a setup waiting for 620 cross
    const waiting = context.activeSetups?.find(
      (s) => s.state === 'READY' || s.state === 'BUILDING',
    );
    if (!waiting) return null;

    // Need ema6/ema20 from the bars (pre-computed in intraday bars)
    // For this detector, we use the last 2 bars to detect the cross
    const prev = bars[bars.length - 2];
    const curr = bars[bars.length - 1];

    // Simple proxy: use close-based short-term averages
    // In production, ema6/ema20 would be pre-computed on StockIntraday
    const recentCloses = bars.slice(-20).map((b) => b.close);
    if (recentCloses.length < 20) return null;

    const ema6Curr = this.sma(recentCloses.slice(-6));
    const ema20Curr = this.sma(recentCloses);
    const ema6Prev = this.sma(recentCloses.slice(-7, -1));
    const ema20Prev = this.sma(recentCloses.slice(0, -1));

    // Detect cross
    const prevBelow = ema6Prev < ema20Prev;
    const currAbove = ema6Curr > ema20Curr;
    const prevAbove = ema6Prev > ema20Prev;
    const currBelow = ema6Curr < ema20Curr;

    const bullishCross = prevBelow && currAbove;
    const bearishCross = prevAbove && currBelow;

    if (!bullishCross && !bearishCross) return null;

    return {
      type: SetupType.CROSS_620,
      direction: bullishCross ? 'LONG' : 'SHORT',
      timeframe: 'INTRADAY',
      pivotPrice: curr.close,
      evidence: [bullishCross ? 'bullish_620_cross' : 'bearish_620_cross'],
      metadata: {
        ema6: ema6Curr,
        ema20: ema20Curr,
        triggerPrice: curr.close,
      },
    };
  }

  private sma(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
