import { Bar } from '../../../common/types';
import { averageBarSize } from './average-bar-size';
import { atrSeries } from './atr';

export interface SwingPointResult {
  index: number;
  price: number;
  type: 'HIGH' | 'LOW';
  atr: number;
  prominence: number;
}

// ---------------------------------------------------------------------------
// Legacy: simple one-sided lookahead pivots (used by VCP / Intraday Base)
// ---------------------------------------------------------------------------

/**
 * Simple fractal pivot detection (renamed from the old detectSwingPoints).
 * Uses one-sided lookahead with ABS tolerance.
 * Kept for VCP contraction-cycle and Intraday Base internal use.
 */
export function detectFractalPivots(
  bars: Bar[],
  lookahead = 10,
): SwingPointResult[] {
  if (bars.length < lookahead + 1) return [];

  const abs = averageBarSize(bars);
  const atrValues = atrSeries(bars);
  const points: SwingPointResult[] = [];

  for (let t = 0; t <= bars.length - lookahead - 1; t++) {
    const h0 = bars[t].high;
    const l0 = bars[t].low;
    const a = Number.isFinite(atrValues[t]) ? atrValues[t] : abs;

    // Check swing high
    let isSwingHigh = true;
    for (let i = t + 1; i <= t + lookahead; i++) {
      if (bars[i].high >= h0 - abs) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      points.push({ index: t, price: h0, type: 'HIGH', atr: a, prominence: 0 });
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
      points.push({ index: t, price: l0, type: 'LOW', atr: a, prominence: 0 });
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// New: ATR-based significant swing detection
// ---------------------------------------------------------------------------

export interface SwingDetectOpts {
  /** Fractal left lookback (default 3) */
  left?: number;
  /** Fractal right lookahead (default 3) */
  right?: number;
  /** ATR period (default 14) */
  atrPeriod?: number;
  /** Prominence threshold in ATR multiples (default 1.5) */
  promAtr?: number;
  /** Departure threshold in ATR multiples (default 2.5) */
  departAtr?: number;
  /** Departure lookahead bars (default 10) */
  departLookahead?: number;
  /** Minimum spacing between same-type swings in bars (default 7) */
  minSwingSep?: number;
}

/**
 * Detect significant swing points using 4 conditions:
 *
 * (A) Fractal: High[t] is the max of [t-left .. t+right] (or min for lows)
 * (B) Prominence: height relative to the opposite extreme in the fractal
 *     window must be >= promAtr * ATR
 * (C) Departure: within departLookahead bars after the pivot, price must
 *     move >= departAtr * ATR away from the pivot level
 * (D) Spacing / de-dup: within minSwingSep bars, only the most extreme
 *     same-type pivot is kept
 */
export function detectSignificantSwingPoints(
  bars: Bar[],
  opts?: SwingDetectOpts,
): SwingPointResult[] {
  const {
    left = 3,
    right = 3,
    atrPeriod = 14,
    promAtr = 1.5,
    departAtr = 2.5,
    departLookahead = 10,
    minSwingSep = 7,
  } = opts ?? {};

  if (bars.length < left + right + 2) return [];

  const atrValues = atrSeries(bars, atrPeriod);
  const candidates: SwingPointResult[] = [];

  for (let t = left; t <= bars.length - right - 1; t++) {
    const a = atrValues[t];
    if (!Number.isFinite(a) || a <= 0) continue;

    // --- (A) Fractal pivot high ---
    let isPivotHigh = true;
    for (let i = t - left; i <= t + right; i++) {
      if (i === t) continue;
      if (bars[i].high >= bars[t].high) {
        isPivotHigh = false;
        break;
      }
    }

    if (isPivotHigh) {
      // (B) Prominence
      let localMinLow = Infinity;
      for (let i = t - left; i <= t + right; i++) {
        if (bars[i].low < localMinLow) localMinLow = bars[i].low;
      }
      const prominence = bars[t].high - localMinLow;

      if (prominence >= promAtr * a) {
        // (C) Departure
        const depEnd = Math.min(bars.length - 1, t + departLookahead);
        let minLowAfter = Infinity;
        for (let j = t + 1; j <= depEnd; j++) {
          if (bars[j].low < minLowAfter) minLowAfter = bars[j].low;
        }

        if (minLowAfter <= bars[t].high - departAtr * a) {
          candidates.push({
            index: t,
            price: bars[t].high,
            type: 'HIGH',
            atr: a,
            prominence,
          });
        }
      }
    }

    // --- (A) Fractal pivot low ---
    let isPivotLow = true;
    for (let i = t - left; i <= t + right; i++) {
      if (i === t) continue;
      if (bars[i].low <= bars[t].low) {
        isPivotLow = false;
        break;
      }
    }

    if (isPivotLow) {
      // (B) Prominence
      let localMaxHigh = -Infinity;
      for (let i = t - left; i <= t + right; i++) {
        if (bars[i].high > localMaxHigh) localMaxHigh = bars[i].high;
      }
      const prominence = localMaxHigh - bars[t].low;

      if (prominence >= promAtr * a) {
        // (C) Departure
        const depEnd = Math.min(bars.length - 1, t + departLookahead);
        let maxHighAfter = -Infinity;
        for (let j = t + 1; j <= depEnd; j++) {
          if (bars[j].high > maxHighAfter) maxHighAfter = bars[j].high;
        }

        if (maxHighAfter >= bars[t].low + departAtr * a) {
          candidates.push({
            index: t,
            price: bars[t].low,
            type: 'LOW',
            atr: a,
            prominence,
          });
        }
      }
    }
  }

  // --- (D) Spacing / de-dup ---
  candidates.sort((a, b) => a.index - b.index);
  const result: SwingPointResult[] = [];

  for (const p of candidates) {
    const last = result[result.length - 1];
    if (!last) {
      result.push(p);
      continue;
    }

    if (p.type === last.type && p.index - last.index <= minSwingSep) {
      // Keep the more extreme one
      const keepNew =
        p.type === 'HIGH' ? p.price > last.price : p.price < last.price;
      if (keepNew) {
        result[result.length - 1] = p;
      }
    } else {
      result.push(p);
    }
  }

  return result;
}
