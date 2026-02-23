import { SetupType } from '@prisma/client';
import { Bar } from '../../../../common/types';
import { SwingPointResult, classifyVolume } from '../../primitives';
import {
  DailyDetector,
  DailyDetectorContext,
  DetectedSetup,
} from '../detector.interface';

/**
 * Type A: Trend-Following EMA20 Pullback LONG (post-breakout / HTF)
 *
 * Structure-gated MA setup: EMA20 acts as an execution zone
 * in either:
 *   1) post-breakout context, or
 *   2) base-pivot context with range contraction.
 *
 * Gating (all must be true):
 *   - regime === 'TREND'
 *   - Context is either:
 *       a) active TRIGGERED breakout setup (BREAKOUT_PIVOT / VCP / HIGH_TIGHT_FLAG), or
 *       b) active VCP base in BUILDING/READY with recent range contraction
 *
 * Structure conditions:
 *   - EMA20 > SMA50 (ordered)
 *   - Meaningful departure: max(Close since breakout) >= EMA20 + 2.0*ATR
 *   - Volume on recent pullback bars is CONTRACTION or NORMAL
 *
 * Entry (touch-based):
 *   - Latest bar touches EMA20 (low <= ema20 <= high)
 *   - Optional proximity guard: abs(close - ema20) <= 1 * ATR
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

    // Context A: active triggered breakout/VCP/HTF
    const breakoutTypes: string[] = [
      'BREAKOUT_PIVOT',
      'VCP',
      'HIGH_TIGHT_FLAG',
    ];
    const hasActiveBreakout = context.activeSetups?.some(
      (s) => breakoutTypes.includes(s.type) && s.state === 'TRIGGERED',
    );

    // Context B: active base pivot + contraction
    const hasActiveBase = context.activeSetups?.some(
      (s) =>
        s.type === ('VCP' as SetupType) &&
        (s.state === 'BUILDING' || s.state === 'READY'),
    );
    const ranges = bars.map((b) => b.high - b.low);
    const recentRanges = ranges.slice(-3);
    const priorRanges = ranges.slice(-8, -3);
    const avgRecentRange =
      recentRanges.length > 0
        ? recentRanges.reduce((acc, v) => acc + v, 0) / recentRanges.length
        : Infinity;
    const avgPriorRange =
      priorRanges.length > 0
        ? priorRanges.reduce((acc, v) => acc + v, 0) / priorRanges.length
        : Infinity;
    const hasContraction =
      Number.isFinite(avgRecentRange) &&
      Number.isFinite(avgPriorRange) &&
      avgRecentRange <= 0.8 * avgPriorRange;

    const hasBasePivotPullbackContext = Boolean(hasActiveBase && hasContraction);
    if (!hasActiveBreakout && !hasBasePivotPullbackContext) return null;

    const latestBar = bars[bars.length - 1];

    // Meaningful departure: max close in the window must be >= ema20 + 2.0*ATR
    let maxClose = -Infinity;
    for (const b of bars) {
      if (b.close > maxClose) maxClose = b.close;
    }
    if (maxClose < ema20 + 2.0 * atr) return null;

    // Touch-based entry: candle must interact with EMA20
    const touchedEma20 = latestBar.low <= ema20 && latestBar.high >= ema20;
    if (!touchedEma20) return null;

    // Proximity guard (keeps noisy far-close touches out)
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
        hasActiveBreakout ? 'active_breakout' : 'base_pivot_contraction',
        'ema20_pullback_touch',
        'meaningful_departure',
      ],
      metadata: {
        context: hasActiveBreakout ? 'POST_BREAKOUT' : 'BASE_PIVOT_CONTRACTION',
        setupClass: 'TREND_FOLLOWING_20EMA_PULLBACK',
        regime: 'TREND',
        ema20,
        sma50,
        touchedEma20,
        hasContraction,
        avgRecentRange: Number.isFinite(avgRecentRange)
          ? Math.round(avgRecentRange * 100) / 100
          : undefined,
        avgPriorRange: Number.isFinite(avgPriorRange)
          ? Math.round(avgPriorRange * 100) / 100
          : undefined,
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
