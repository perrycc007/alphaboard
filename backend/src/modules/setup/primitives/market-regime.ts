import { Bar } from '../../../common/types';
import { priceEfficiency } from './price-efficiency';
import { emaGapSeries, isConverging } from './ema-gap';

export type MarketRegime = 'TREND' | 'FAILURE' | 'CHOP';

export interface MarketRegimeInput {
  bars: Bar[];
  ema20?: number;
  sma50?: number;
  sma200?: number;
  atr14?: number;
  activeSetups?: Array<{
    type: string;
    state: string;
  }>;
}

/**
 * Detect current market regime.
 *
 * CHOP  – checked first (any one true):
 *   • priceEfficiency(last 30) < 0.25
 *   • EMA20/SMA50/SMA200 all within 1 ATR (tangled)
 *   • Price crossed SMA200 3+ times in last 30 bars
 *
 * FAILURE – (any one true, and not CHOP):
 *   • Active FAIL_BASE in TRIGGERED state
 *   • Close < SMA50 AND EMA20 < SMA50
 *
 * TREND – default if not CHOP/FAILURE, requires at least 2 of:
 *   • priceEfficiency(last 20) > 0.4
 *   • SMA50 sloping up (now vs 10 bars ago)
 *   • EMA20 > SMA50
 *   • EMA gap not converging
 *
 * Fallback: CHOP
 */
export function detectMarketRegime(input: MarketRegimeInput): MarketRegime {
  const { bars, ema20, sma50, sma200, atr14, activeSetups } = input;

  if (bars.length < 5) return 'CHOP';

  const atr = atr14 ?? 0;

  // ── CHOP checks ──────────────────────────────────────────
  const recentBars = bars.slice(-30);
  const eff30 = priceEfficiency(recentBars);
  if (eff30 < 0.25) return 'CHOP';

  // MA tangling: all three within 1 ATR of each other
  if (ema20 != null && sma50 != null && sma200 != null && atr > 0) {
    const vals = [ema20, sma50, sma200];
    const spread = Math.max(...vals) - Math.min(...vals);
    if (spread < atr) return 'CHOP';
  }

  // SMA200 cross count in last 30 bars
  if (sma200 != null && recentBars.length >= 2) {
    let crossCount = 0;
    for (let i = 1; i < recentBars.length; i++) {
      const prevAbove = recentBars[i - 1].close > sma200;
      const currAbove = recentBars[i].close > sma200;
      if (prevAbove !== currAbove) crossCount++;
    }
    if (crossCount >= 3) return 'CHOP';
  }

  // ── FAILURE checks ──────────────────────────────────────
  const hasFailBase = activeSetups?.some(
    (s) => s.type === 'FAIL_BASE' && s.state === 'TRIGGERED',
  );
  if (hasFailBase) return 'FAILURE';

  if (
    sma50 != null &&
    ema20 != null &&
    bars[bars.length - 1].close < sma50 &&
    ema20 < sma50
  ) {
    return 'FAILURE';
  }

  // ── TREND checks (need >= 2 of 4) ──────────────────────
  let trendSignals = 0;

  const eff20 = priceEfficiency(bars.slice(-20));
  if (eff20 > 0.4) trendSignals++;

  // SMA50 sloping up: approximate from bars if we have enough
  if (sma50 != null && bars.length >= 10) {
    // We derive a rough SMA50 slope from close-to-sma50 relationship
    // across bars. Since we only have the latest sma50 value, we check
    // if price 10 bars ago was significantly lower than current sma50.
    // This is a proxy: if close[now] > close[-10] and close > sma50,
    // the MA is likely rising.
    const recent = bars[bars.length - 1].close;
    const older = bars[bars.length - 10].close;
    if (recent > older && recent > sma50) trendSignals++;
  }

  if (ema20 != null && sma50 != null && ema20 > sma50) trendSignals++;

  // EMA gap not converging
  if (bars.length >= 20) {
    const gap = emaGapSeries(bars, 20, 50);
    if (gap.length >= 10 && !isConverging(gap, 10)) trendSignals++;
  }

  if (trendSignals >= 2) return 'TREND';

  return 'CHOP';
}
