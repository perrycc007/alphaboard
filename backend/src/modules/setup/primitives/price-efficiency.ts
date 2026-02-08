import { Bar } from '../../../common/types';

/**
 * Price Efficiency Ratio
 * Efficiency = |Close_end - Close_start| / Sum(|Close[i] - Close[i-1]|)
 *
 * High value = trending cleanly
 * Low value = choppy / tiring
 */
export function priceEfficiency(bars: Bar[]): number {
  if (bars.length < 2) return 0;

  const netMove = Math.abs(bars[bars.length - 1].close - bars[0].close);
  let totalPath = 0;

  for (let i = 1; i < bars.length; i++) {
    totalPath += Math.abs(bars[i].close - bars[i - 1].close);
  }

  if (totalPath === 0) return 0;
  return netMove / totalPath;
}
