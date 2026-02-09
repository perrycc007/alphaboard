import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Type C: SMA200 Key Level (LONG or SHORT)
 *
 * SMA200 as a major structural level. Only active when the market
 * is not in CHOP and price has meaningfully departed from SMA200.
 *
 * Note: Uses SMA200 (the pre-computed MA in the database).
 *
 * Gating:
 *   - regime !== 'CHOP'
 *
 * Meaningful departure:
 *   - abs(max or min close - sma200) >= 3 * ATR at some point in the window
 *
 * Chop cross filter:
 *   - Price has NOT crossed SMA200 3+ times in last 30 bars
 *
 * Touch detection:
 *   - low <= sma200 <= high
 *
 * Direction:
 *   - SMA200 slope up (proxy: close > close 10 bars ago): LONG
 *   - SMA200 slope down: SHORT
 */
export class Sma200KeyLevelDetector implements DailyDetector {
  type = 'EMA200_KEY_LEVEL' as SetupType;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 30) return null;
    if (context.regime === 'CHOP') return null;

    const atr = context.atr14 ?? 0;
    if (atr <= 0) return null;
    const sma200 = context.sma200;
    if (sma200 == null) return null;

    const latestBar = bars[bars.length - 1];
    const recentBars = bars.slice(-30);

    // --- Chop cross filter ---
    let crossCount = 0;
    for (let i = 1; i < recentBars.length; i++) {
      const prevAbove = recentBars[i - 1].close > sma200;
      const currAbove = recentBars[i].close > sma200;
      if (prevAbove !== currAbove) crossCount++;
    }
    if (crossCount >= 3) return null;

    // --- Meaningful departure ---
    let maxDeparture = 0;
    for (const b of bars) {
      const dep = Math.abs(b.close - sma200);
      if (dep > maxDeparture) maxDeparture = dep;
    }
    if (maxDeparture < 3 * atr) return null;

    // --- Touch detection ---
    const touchesSma200 =
      latestBar.low <= sma200 && sma200 <= latestBar.high;
    if (!touchesSma200) return null;

    // --- Direction ---
    // Slope proxy: compare recent close trend
    const slopeUp =
      bars.length >= 10 &&
      bars[bars.length - 1].close > bars[bars.length - 10].close;
    const direction = slopeUp ? 'LONG' : 'SHORT';

    const stopBuffer = 1 * atr;
    const stopPrice =
      direction === 'LONG'
        ? sma200 - stopBuffer
        : sma200 + stopBuffer;
    const riskPerShare = Math.abs(latestBar.close - stopPrice);

    return {
      type: 'EMA200_KEY_LEVEL' as SetupType,
      direction,
      timeframe: 'DAILY',
      pivotPrice: sma200,
      stopPrice,
      targetPrice:
        riskPerShare > 0
          ? direction === 'LONG'
            ? latestBar.close + riskPerShare * 3
            : latestBar.close - riskPerShare * 3
          : undefined,
      riskReward: 3,
      evidence: [
        'meaningful_departure',
        'sma200_touch',
        `direction_${direction.toLowerCase()}`,
      ],
      metadata: {
        context: 'MEANINGFUL_DEPARTURE',
        sma200,
        departureATR: Math.round((maxDeparture / atr) * 100) / 100,
        crossCount,
        slopeUp,
        regime: context.regime,
        atrUsed: atr,
      },
    };
  }
}
