import { Injectable } from '@nestjs/common';
import { Bar } from '../../../common/types';
import { detectSignificantSwingPoints } from '../primitives';

export type KeyLevelType =
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'SMA20'
  | 'SMA50'
  | 'SMA150'
  | 'SMA200'
  | 'EMA20'
  | 'RANGE_HIGH'
  | 'RANGE_LOW';

export interface KeyLevel {
  type: KeyLevelType;
  price: number;
  distancePct: number; // signed: + means level is above current close
  position: 'ABOVE' | 'BELOW' | 'AT';
}

export interface KeyLevelProximity {
  close: number;
  levels: KeyLevel[];
  nearest: KeyLevel[]; // within proximity threshold, sorted by abs distance
  nearKeyLevel: boolean;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

/**
 * Identifies the key reference levels (moving averages, swing pivots, range
 * extremes) closest to the current price and how near price is to each.
 * Pure, stateless detection used by loose-setup and focus-list logic.
 */
@Injectable()
export class KeyLevelCandidateService {
  analyze(bars: Bar[], proximityPct = 2): KeyLevelProximity {
    const close = bars.length ? bars[bars.length - 1].close : 0;
    const result: KeyLevelProximity = {
      close,
      levels: [],
      nearest: [],
      nearKeyLevel: false,
    };
    if (bars.length === 0 || close === 0) return result;

    const closes = bars.map((b) => b.close);
    const levels: KeyLevel[] = [];

    const maDefs: Array<[KeyLevelType, number | null]> = [
      ['SMA20', sma(closes, 20)],
      ['SMA50', sma(closes, 50)],
      ['SMA150', sma(closes, 150)],
      ['SMA200', sma(closes, 200)],
      ['EMA20', ema(closes, 20)],
    ];
    for (const [type, value] of maDefs) {
      if (value != null) levels.push(this.toLevel(type, value, close));
    }

    const swings = detectSignificantSwingPoints(bars);
    const lastHigh = [...swings].reverse().find((s) => s.type === 'HIGH');
    const lastLow = [...swings].reverse().find((s) => s.type === 'LOW');
    if (lastHigh) levels.push(this.toLevel('SWING_HIGH', lastHigh.price, close));
    if (lastLow) levels.push(this.toLevel('SWING_LOW', lastLow.price, close));

    const window = bars.slice(-60);
    levels.push(
      this.toLevel('RANGE_HIGH', Math.max(...window.map((b) => b.high)), close),
    );
    levels.push(
      this.toLevel('RANGE_LOW', Math.min(...window.map((b) => b.low)), close),
    );

    result.levels = levels;
    result.nearest = levels
      .filter((l) => Math.abs(l.distancePct) <= proximityPct)
      .sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));
    result.nearKeyLevel = result.nearest.length > 0;
    return result;
  }

  private toLevel(type: KeyLevelType, price: number, close: number): KeyLevel {
    const distancePct = ((price - close) / close) * 100;
    const position =
      Math.abs(distancePct) < 0.1 ? 'AT' : distancePct > 0 ? 'ABOVE' : 'BELOW';
    return { type, price, distancePct, position };
  }
}
