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
    if (bars.length < 20) return null;
    if (context.regime !== 'TREND') return null;

    const atr = context.atr14 ?? 0;
    if (atr <= 0) return null;
    const ema20 = context.ema20;
    const sma50 = context.sma50;
    if (ema20 == null || sma50 == null) return null;

    // EMA20 must be above SMA50 (ordered trend)
    if (ema20 <= sma50) return null;

    const latestBar = bars[bars.length - 1];
    const latestBarDate = latestBar.date ?? null;

    // Context A: active triggered breakout/VCP/HTF within a recent trend phase.
    const breakoutTypes: string[] = [
      'BREAKOUT_PIVOT',
      'VCP',
      'HIGH_TIGHT_FLAG',
    ];
    const activeBreakout = context.activeSetups?.find(
      (s) =>
        breakoutTypes.includes(s.type) &&
        s.state === 'TRIGGERED' &&
        this.isRecentSetupAnchor(
          s.lastStateAt ?? s.detectedAt,
          latestBarDate,
          35,
        ),
    );
    const hasActiveBreakout = Boolean(activeBreakout);

    // Context B: active base pivot + contraction
    const activeBase = context.activeSetups?.find(
      (s) =>
        s.type === ('VCP' as SetupType) &&
        (s.state === 'BUILDING' || s.state === 'READY') &&
        this.isRecentSetupAnchor(
          s.lastStateAt ?? s.detectedAt,
          latestBarDate,
          45,
        ),
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

    const hasBasePivotPullbackContext = Boolean(activeBase && hasContraction);
    if (!hasActiveBreakout && !hasBasePivotPullbackContext) return null;

    // Meaningful departure should be recent, not something that happened months ago.
    const recentDepartureWindow = bars.slice(-15, -1);
    const maxClose =
      recentDepartureWindow.length > 0
        ? Math.max(...recentDepartureWindow.map((b) => b.close))
        : -Infinity;
    if (maxClose < ema20 + 1.5 * atr) return null;

    // Touch-based entry: candle must interact with EMA20
    const touchedEma20 = latestBar.low <= ema20 && latestBar.high >= ema20;
    if (!touchedEma20) return null;

    // Proximity guard (keeps noisy far-close touches out)
    const distFromEma20 = Math.abs(latestBar.close - ema20);
    if (distFromEma20 > 0.6 * atr) return null;

    // Precision-first: require a constructive touch, not a weak close through EMA20.
    if (latestBar.close < ema20 || latestBar.close < sma50) return null;
    const closeLocation =
      latestBar.high > latestBar.low
        ? (latestBar.close - latestBar.low) / (latestBar.high - latestBar.low)
        : 0;
    if (closeLocation < 0.55) return null;

    const pullbackBars = bars.slice(-3);
    if (pullbackBars.length < 3) return null;
    const descendingHighs =
      pullbackBars[0].high >= pullbackBars[1].high &&
      pullbackBars[1].high >= pullbackBars[2].high;
    const heldAboveSma50 = pullbackBars.every((b) => b.close >= sma50);
    if (!descendingHighs || !heldAboveSma50) return null;

    // Volume on pullback bars (last 3) should not be EXPANSION
    const avgVol = context.avgVolume ?? 0;
    if (avgVol > 0) {
      const hasExpansion = pullbackBars.some(
        (b) => classifyVolume(b.volume, avgVol) === 'EXPANSION',
      );
      if (hasExpansion) return null;
      if (latestBar.volume > avgVol * 1.15) return null;
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
        closeLocation: Math.round(closeLocation * 100) / 100,
        descendingHighs,
        heldAboveSma50,
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
        anchorAgeDays: this.anchorAgeDays(
          activeBreakout?.lastStateAt ??
            activeBreakout?.detectedAt ??
            activeBase?.lastStateAt ??
            activeBase?.detectedAt,
          latestBarDate,
        ),
      },
    };
  }

  private isRecentSetupAnchor(
    anchorDate: Date | undefined,
    latestBarDate: Date | null,
    maxAgeDays: number,
  ): boolean {
    if (!anchorDate || !latestBarDate) return true;
    return this.anchorAgeDays(anchorDate, latestBarDate) <= maxAgeDays;
  }

  private anchorAgeDays(anchorDate: Date | undefined, latestBarDate: Date | null): number | null {
    if (!anchorDate || !latestBarDate) return null;
    return Math.floor(
      (latestBarDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }
}
