import { Injectable } from '@nestjs/common';
import { Bar } from '../../../common/types';
import {
  emaGapSeries,
  isConverging,
  macdHistogram,
  isHistogramContracting,
} from '../primitives';

export type Reversal620State =
  | 'NOT_RELEVANT'
  | 'WATCHING'
  | 'TESTING_LEVEL'
  | 'COMPRESSING'
  | 'ALMOST_READY'
  | 'READY_TO_CONFIRM'
  | 'CROSSED'
  | 'FAILED'
  | 'STALE';

export type Reversal620Alert =
  | 'NONE'
  | '620_WATCH'
  | '620_COMPRESSING'
  | '620_ALMOST_READY'
  | '620_CROSSED'
  | '620_FAILED';

export interface Reversal620Input {
  /** 5-minute intraday bars (most recent last) */
  bars: Bar[];
  direction: 'LONG' | 'SHORT';
  /** Planned reversal key level (support for LONG, resistance for SHORT) */
  keyLevel: number;
  /** Only monitor focus-list stocks with reversal context */
  focusToday?: boolean;
  hasReversalContext?: boolean;
  /** Setup invalidation level (optional) */
  invalidationLevel?: number;
}

export interface Reversal620Evidence {
  distancePct: number;
  ema6: number;
  ema20: number;
  ema6Below20: boolean;
  gapContracting: boolean;
  macdContracting: boolean;
  crossed: boolean;
  nearLevel: boolean;
}

export interface Reversal620Result {
  state: Reversal620State;
  alert: Reversal620Alert;
  evidence: Reversal620Evidence | null;
  rationale: string;
}

function computeEma(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    out.push(prices[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

/**
 * Early-warning state machine for "620" reversal timing.
 *
 * 620 is *reversal timing only* — it alerts when a reversal candidate is
 * almost ready, it never forces an entry. Priority is below daily/intraday
 * setup quality, so this only runs for focus-list stocks that already carry a
 * reversal context. Pure and stateless: caller supplies intraday bars + level.
 */
@Injectable()
export class Reversal620ReadinessService {
  evaluate(input: Reversal620Input): Reversal620Result {
    const { bars, direction, keyLevel } = input;

    if (input.focusToday === false || input.hasReversalContext === false) {
      return {
        state: 'NOT_RELEVANT',
        alert: 'NONE',
        evidence: null,
        rationale: 'Not a focus-list stock with reversal context',
      };
    }
    if (bars.length < 30 || keyLevel <= 0) {
      return {
        state: 'WATCHING',
        alert: 'NONE',
        evidence: null,
        rationale: 'Insufficient intraday data to assess 620 readiness',
      };
    }

    const closes = bars.map((b) => b.close);
    const close = closes[closes.length - 1];
    const ema6Arr = computeEma(closes, 6);
    const ema20Arr = computeEma(closes, 20);
    const ema6 = ema6Arr[ema6Arr.length - 1];
    const ema20 = ema20Arr[ema20Arr.length - 1];
    const prevEma6 = ema6Arr[ema6Arr.length - 2];
    const prevEma20 = ema20Arr[ema20Arr.length - 2];

    const gapContracting = isConverging(emaGapSeries(bars, 6, 20), 6);
    const macdContracting = isHistogramContracting(macdHistogram(bars, 6, 20, 9), 6);

    const distancePct = ((keyLevel - close) / close) * 100;
    const nearLevel = Math.abs(distancePct) <= 0.5;
    const ema6Below20 = ema6 <= ema20;

    const crossedLong = prevEma6 <= prevEma20 && ema6 > ema20;
    const crossedShort = prevEma6 >= prevEma20 && ema6 < ema20;
    const crossed = direction === 'LONG' ? crossedLong : crossedShort;

    const evidence: Reversal620Evidence = {
      distancePct,
      ema6,
      ema20,
      ema6Below20,
      gapContracting,
      macdContracting,
      crossed,
      nearLevel,
    };

    // Invalidation check
    if (input.invalidationLevel != null) {
      const violated =
        direction === 'LONG'
          ? close < input.invalidationLevel
          : close > input.invalidationLevel;
      if (violated) {
        return {
          state: 'FAILED',
          alert: '620_FAILED',
          evidence,
          rationale: 'Price violated the setup invalidation level',
        };
      }
    }

    // Crossed near the planned level
    if (crossed && nearLevel) {
      return {
        state: 'CROSSED',
        alert: '620_CROSSED',
        evidence,
        rationale: '620 crossed near the planned key level',
      };
    }

    // Moved too far from the level → stale
    if (Math.abs(distancePct) > 3) {
      return {
        state: 'STALE',
        alert: 'NONE',
        evidence,
        rationale: 'Price moved away from the reversal level',
      };
    }

    const compressing = gapContracting && macdContracting;

    if (nearLevel && compressing) {
      return {
        state: 'READY_TO_CONFIRM',
        alert: '620_ALMOST_READY',
        evidence,
        rationale: 'At level with 620 compressed — one strong bar could trigger',
      };
    }
    if (nearLevel && (gapContracting || macdContracting)) {
      return {
        state: 'ALMOST_READY',
        alert: '620_ALMOST_READY',
        evidence,
        rationale: 'Holding the level while 620 tightens',
      };
    }
    if (compressing) {
      return {
        state: 'COMPRESSING',
        alert: '620_COMPRESSING',
        evidence,
        rationale: 'EMA6/20 gap and MACD histogram contracting toward a cross',
      };
    }
    if (nearLevel) {
      return {
        state: 'TESTING_LEVEL',
        alert: '620_WATCH',
        evidence,
        rationale: 'Price testing the planned reversal level',
      };
    }

    return {
      state: 'WATCHING',
      alert: 'NONE',
      evidence,
      rationale: 'Reversal context present; price approaching level',
    };
  }
}
