import { Bar } from '../../../common/types';

/**
 * Compute EMA for an array of prices.
 */
function computeEma(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

/**
 * Returns series of |EMA_fast - EMA_slow| for convergence detection.
 */
export function emaGapSeries(
  bars: Bar[],
  fast: number,
  slow: number,
): number[] {
  if (bars.length < slow) return [];
  const closes = bars.map((b) => b.close);
  const emaFast = computeEma(closes, fast);
  const emaSlow = computeEma(closes, slow);
  return emaFast.map((f, i) => Math.abs(f - emaSlow[i]));
}

/**
 * Check if the EMA gap series is converging (decreasing) over the lookback window.
 */
export function isConverging(series: number[], lookback: number): boolean {
  if (series.length < lookback) return false;
  const tail = series.slice(-lookback);
  let decreasingCount = 0;
  for (let i = 1; i < tail.length; i++) {
    if (tail[i] < tail[i - 1]) decreasingCount++;
  }
  return decreasingCount >= (tail.length - 1) * 0.6;
}
