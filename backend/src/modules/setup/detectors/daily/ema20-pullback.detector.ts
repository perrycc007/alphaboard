import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, classifyVolume } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Type A: EMA20 Pullback LONG (post-breakout / HTF)
 *
 * Structure-gated MA setup: EMA20 acts as an execution zone
 * only when there is an active breakout or high-tight-flag context.
 *
 * Gating (all must be true):
 *   - regime === 'TREND'
 *   - Active TRIGGERED setup of type BREAKOUT_PIVOT / VCP / HIGH_TIGHT_FLAG
 *
 * Structure conditions:
 *   - EMA20 > SMA50 (ordered)
 *   - Meaningful departure: max(Close since breakout) >= EMA20 + 2.5*ATR
 *   - Volume on recent pullback bars is CONTRACTION or NORMAL
 *
 * Entry:
 *   - Price near EMA20: abs(close - ema20) <= 1 * ATR
 */
export class Ema20PullbackDetector implements DailyDetector {
  type = 'EMA20_PULLBACK' as SetupType;

  detect(
    bars: Bar[],
    _swingPoints: SwingPointResult[],
    context: DailyDetectorContext,
  ): DetectedSetup | null {
    if (bars.length < 10) return null;
    if (context.regime !== 'TREND') return null;

    const atr = context.atr14 ?? 0;
    if (atr <= 0) return null;
    const ema20 = context.ema20;
    const sma50 = context.sma50;
    if (ema20 == null || sma50 == null) return null;

    // EMA20 must be above SMA50 (ordered trend)
    if (ema20 <= sma50) return null;

    // Gating: active triggered breakout/VCP/HTF
    const breakoutTypes: string[] = [
      'BREAKOUT_PIVOT',
      'VCP',
      'HIGH_TIGHT_FLAG',
    ];
    const hasActiveBreakout = context.activeSetups?.some(
      (s) => breakoutTypes.includes(s.type) && s.state === 'TRIGGERED',
    );
    if (!hasActiveBreakout) return null;

    const latestBar = bars[bars.length - 1];

    // Meaningful departure: max close in the window must be >= ema20 + 2.5*ATR
    let maxClose = -Infinity;
    for (const b of bars) {
      if (b.close > maxClose) maxClose = b.close;
    }
    if (maxClose < ema20 + 2.5 * atr) return null;

    // Price near EMA20
    const distFromEma20 = Math.abs(latestBar.close - ema20);
    if (distFromEma20 > 1 * atr) return null;

    // Volume on pullback bars (last 3) should not be EXPANSION
    const avgVol = context.avgVolume ?? 0;
    if (avgVol > 0) {
      const recentBars = bars.slice(-3);
      const hasExpansion = recentBars.some(
        (b) => classifyVolume(b.volume, avgVol) === 'EXPANSION',
      );
      if (hasExpansion) return null;
    }

    const stopPrice = ema20 - 1 * atr;
    const riskPerShare = latestBar.close - stopPrice;

    return {
      type: 'EMA20_PULLBACK' as SetupType,
      direction: 'LONG',
      timeframe: 'DAILY',
      pivotPrice: ema20,
      stopPrice,
      targetPrice:
        riskPerShare > 0 ? latestBar.close + riskPerShare * 3 : undefined,
      riskReward: 3,
      evidence: [
        'regime_trend',
        'active_breakout',
        'ema20_pullback',
        'meaningful_departure',
      ],
      metadata: {
        context: 'POST_BREAKOUT',
        regime: 'TREND',
        ema20,
        sma50,
        departureClose: maxClose,
        departureAtr:
          Math.round(((maxClose - ema20) / atr) * 100) / 100,
        distFromEma20Atr:
          Math.round((distFromEma20 / atr) * 100) / 100,
        atrUsed: atr,
      },
    };
  }
}
