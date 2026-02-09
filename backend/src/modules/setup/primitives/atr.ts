import { Bar } from '../../../common/types';

/**
 * True Range for a single bar.
 * TR = max(High - Low, |High - prevClose|, |Low - prevClose|)
 * If no previous bar, TR = High - Low.
 */
export function trueRange(bar: Bar, prev?: Bar): number {
  if (!prev) return bar.high - bar.low;
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - prev.close),
    Math.abs(bar.low - prev.close),
  );
}

/**
 * ATR series (rolling average of True Range).
 * Returns one value per bar. Values before the warm-up period are NaN.
 */
export function atrSeries(bars: Bar[], period = 14): number[] {
  const tr: number[] = bars.map((b, i) =>
    trueRange(b, i > 0 ? bars[i - 1] : undefined),
  );
  const out: number[] = [];
  let sum = 0;

  for (let i = 0; i < tr.length; i++) {
    sum += tr[i];
    if (i >= period) sum -= tr[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }

  return out;
}
