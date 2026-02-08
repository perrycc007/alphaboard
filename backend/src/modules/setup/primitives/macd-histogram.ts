import { Bar } from '../../../common/types';

function computeEma(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

/**
 * MACD histogram with configurable fast/slow/signal periods.
 * Returns the histogram series.
 */
export function macdHistogram(
  bars: Bar[],
  fast = 6,
  slow = 20,
  signal = 9,
): number[] {
  if (bars.length < slow + signal) return [];

  const closes = bars.map((b) => b.close);
  const emaFast = computeEma(closes, fast);
  const emaSlow = computeEma(closes, slow);

  const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
  const signalLine = computeEma(macdLine, signal);

  return macdLine.map((m, i) => m - signalLine[i]);
}

/**
 * Check if MACD histogram is contracting (absolute values decreasing).
 */
export function isHistogramContracting(
  histogram: number[],
  lookback: number,
): boolean {
  if (histogram.length < lookback) return false;
  const tail = histogram.slice(-lookback);
  let contractingCount = 0;
  for (let i = 1; i < tail.length; i++) {
    if (Math.abs(tail[i]) < Math.abs(tail[i - 1])) contractingCount++;
  }
  return contractingCount >= (tail.length - 1) * 0.6;
}
