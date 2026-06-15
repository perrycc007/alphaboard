import { Injectable } from '@nestjs/common';
import { Bar } from '../../../common/types';
import { detectSignificantSwingPoints } from '../primitives';
import {
  KeyLevel,
  KeyLevelCandidateService,
  KeyLevelProximity,
} from './key-level-candidate.service';

export type LooseSetupType =
  | 'POSSIBLE_PULLBACK'
  | 'POSSIBLE_BREAKOUT'
  | 'POSSIBLE_UNDERCUT_RECLAIM'
  | 'POSSIBLE_FAILED_BREAKOUT'
  | 'POSSIBLE_DOUBLE_TOP'
  | 'POSSIBLE_DOUBLE_BOTTOM'
  | 'POSSIBLE_BASE'
  | 'POSSIBLE_REVERSAL';

export type LooseDirection = 'LONG' | 'SHORT';

export interface LooseSetupCandidate {
  type: LooseSetupType;
  direction: LooseDirection;
  confidence: number; // 0-1, intentionally loose / pre-screen quality
  keyLevel: KeyLevel | null;
  rationale: string;
}

export interface LooseSetupResult {
  candidates: LooseSetupCandidate[];
  keyLevels: KeyLevelProximity;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/**
 * Pre-screen detector that flags *possible* setups with loose thresholds.
 * This is deliberately permissive — it widens the funnel before the strict
 * setup detectors and the model review narrow it down.
 */
@Injectable()
export class LooseSetupCandidateService {
  constructor(private readonly keyLevels: KeyLevelCandidateService) {}

  detect(bars: Bar[]): LooseSetupResult {
    const keyLevels = this.keyLevels.analyze(bars);
    const candidates: LooseSetupCandidate[] = [];
    if (bars.length < 30) return { candidates, keyLevels };

    const closes = bars.map((b) => b.close);
    const last = bars[bars.length - 1];
    const close = last.close;
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);
    const uptrend = sma50 != null && sma200 != null && sma50 > sma200 && close > sma200;
    const downtrend = sma50 != null && sma200 != null && sma50 < sma200 && close < sma200;

    const swings = detectSignificantSwingPoints(bars);
    const highs = swings.filter((s) => s.type === 'HIGH');
    const lows = swings.filter((s) => s.type === 'LOW');
    const lastHigh = highs[highs.length - 1];
    const prevHigh = highs[highs.length - 2];
    const lastLow = lows[lows.length - 1];
    const prevLow = lows[lows.length - 2];

    const near = (level: KeyLevel | undefined, pct = 2.5) =>
      level != null && Math.abs(level.distancePct) <= pct;

    const findLevel = (type: KeyLevel['type']) =>
      keyLevels.levels.find((l) => l.type === type) ?? null;

    // Pullback: uptrend pulling back into a rising MA
    const sma20Level = findLevel('SMA20');
    const sma50Level = findLevel('SMA50');
    if (uptrend && (near(sma20Level ?? undefined) || near(sma50Level ?? undefined))) {
      candidates.push({
        type: 'POSSIBLE_PULLBACK',
        direction: 'LONG',
        confidence: 0.55,
        keyLevel: near(sma20Level ?? undefined) ? sma20Level : sma50Level,
        rationale: 'Uptrend pulling back toward rising moving average',
      });
    }

    // Breakout: pressing against range/swing high
    const rangeHigh = findLevel('RANGE_HIGH');
    if (uptrend && rangeHigh && rangeHigh.position !== 'BELOW' && near(rangeHigh, 1.5)) {
      candidates.push({
        type: 'POSSIBLE_BREAKOUT',
        direction: 'LONG',
        confidence: 0.5,
        keyLevel: rangeHigh,
        rationale: 'Price coiling just under range high',
      });
    }

    // Undercut & reclaim: undercut prior swing low then close back above
    if (prevLow && close > prevLow.price && last.low < prevLow.price) {
      candidates.push({
        type: 'POSSIBLE_UNDERCUT_RECLAIM',
        direction: 'LONG',
        confidence: 0.5,
        keyLevel: { type: 'SWING_LOW', price: prevLow.price, distancePct: ((prevLow.price - close) / close) * 100, position: 'BELOW' },
        rationale: 'Undercut prior swing low and reclaimed it intrabar',
      });
    }

    // Failed breakout: broke above swing high then closed back below
    if (lastHigh && last.high > lastHigh.price && close < lastHigh.price) {
      candidates.push({
        type: 'POSSIBLE_FAILED_BREAKOUT',
        direction: 'SHORT',
        confidence: 0.5,
        keyLevel: { type: 'SWING_HIGH', price: lastHigh.price, distancePct: ((lastHigh.price - close) / close) * 100, position: 'ABOVE' },
        rationale: 'Poked above swing high then closed back below (failed breakout)',
      });
    }

    // Double top / bottom: two comparable pivots
    if (lastHigh && prevHigh && this.withinPct(lastHigh.price, prevHigh.price, 2)) {
      candidates.push({
        type: 'POSSIBLE_DOUBLE_TOP',
        direction: 'SHORT',
        confidence: 0.45,
        keyLevel: { type: 'SWING_HIGH', price: lastHigh.price, distancePct: ((lastHigh.price - close) / close) * 100, position: lastHigh.price > close ? 'ABOVE' : 'BELOW' },
        rationale: 'Two swing highs at a similar level',
      });
    }
    if (lastLow && prevLow && this.withinPct(lastLow.price, prevLow.price, 2)) {
      candidates.push({
        type: 'POSSIBLE_DOUBLE_BOTTOM',
        direction: 'LONG',
        confidence: 0.45,
        keyLevel: { type: 'SWING_LOW', price: lastLow.price, distancePct: ((lastLow.price - close) / close) * 100, position: lastLow.price < close ? 'BELOW' : 'ABOVE' },
        rationale: 'Two swing lows at a similar level',
      });
    }

    // Base: tight range over the last ~15 bars
    if (this.isTightRange(bars.slice(-15))) {
      candidates.push({
        type: 'POSSIBLE_BASE',
        direction: uptrend ? 'LONG' : 'SHORT',
        confidence: 0.4,
        keyLevel: rangeHigh,
        rationale: 'Tight consolidation range forming a base',
      });
    }

    // Reversal: downtrend showing oversold reclaim of short MA
    if (downtrend && sma20Level && close > sma20Level.price) {
      candidates.push({
        type: 'POSSIBLE_REVERSAL',
        direction: 'LONG',
        confidence: 0.4,
        keyLevel: sma20Level,
        rationale: 'Downtrend reclaiming short-term moving average',
      });
    }

    return { candidates, keyLevels };
  }

  private withinPct(a: number, b: number, pct: number): boolean {
    if (b === 0) return false;
    return (Math.abs(a - b) / b) * 100 <= pct;
  }

  private isTightRange(bars: Bar[]): boolean {
    if (bars.length < 10) return false;
    const high = Math.max(...bars.map((b) => b.high));
    const low = Math.min(...bars.map((b) => b.low));
    const mid = (high + low) / 2;
    if (mid === 0) return false;
    return ((high - low) / mid) * 100 <= 8;
  }
}
