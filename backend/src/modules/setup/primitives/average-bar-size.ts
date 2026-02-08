import { Bar } from '../../../common/types';

/**
 * Average Bar Size: SMA(High - Low, N)
 * Measures the typical daily/intraday range over N bars.
 * Used as a tolerance/threshold throughout detection.
 */
export function averageBarSize(bars: Bar[], period = 20): number {
  if (bars.length === 0) return 0;
  const slice = bars.slice(-period);
  const sum = slice.reduce((acc, bar) => acc + (bar.high - bar.low), 0);
  return sum / slice.length;
}
