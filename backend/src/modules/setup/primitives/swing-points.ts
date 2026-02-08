import { Bar } from '../../../common/types';
import { averageBarSize } from './average-bar-size';

export interface SwingPointResult {
  index: number;
  price: number;
  type: 'HIGH' | 'LOW';
  absValue: number;
}

/**
 * Detect Swing Highs and Swing Lows.
 *
 * A bar at index t is a Swing High if:
 *   for all bars i in (t+1 .. t+lookahead): High[i] < H0 - ABS
 *
 * Symmetrically for Swing Low:
 *   for all bars i in (t+1 .. t+lookahead): Low[i] > L0 + ABS
 */
export function detectSwingPoints(
  bars: Bar[],
  lookahead = 10,
): SwingPointResult[] {
  if (bars.length < lookahead + 1) return [];

  const abs = averageBarSize(bars);
  const points: SwingPointResult[] = [];

  for (let t = 0; t <= bars.length - lookahead - 1; t++) {
    const h0 = bars[t].high;
    const l0 = bars[t].low;

    // Check swing high
    let isSwingHigh = true;
    for (let i = t + 1; i <= t + lookahead; i++) {
      if (bars[i].high >= h0 - abs) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      points.push({ index: t, price: h0, type: 'HIGH', absValue: abs });
    }

    // Check swing low
    let isSwingLow = true;
    for (let i = t + 1; i <= t + lookahead; i++) {
      if (bars[i].low <= l0 + abs) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      points.push({ index: t, price: l0, type: 'LOW', absValue: abs });
    }
  }

  return points;
}
