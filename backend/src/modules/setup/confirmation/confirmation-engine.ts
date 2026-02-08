import { Bar } from '../../../common/types';
import { resolveKeyLevels, KeyLevel } from './key-level.resolver';
import { evaluateViolation } from './violation.evaluator';
import {
  isDryUp,
  isWickAbsorption,
  isEngulfing,
  classifyVolume,
  VolumeStateType,
  averageBarSize,
} from '../primitives';

export interface BarEvidenceResult {
  pattern: string;
  bias: 'BULLISH' | 'BEARISH';
  isViolation: boolean;
  keyLevelType: string;
  keyLevelPrice: number;
  volumeState: VolumeStateType;
}

export interface BarContext {
  swingPoints: Array<{ type: string; price: number }>;
  bases: Array<{
    peakPrice: number;
    baseLow: number;
    pivotPrice?: number | null;
  }>;
  indicators: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    vwap?: number;
  };
  avgVolume: number;
  avgRange: number;
}

/**
 * ConfirmationEngine: evaluates each bar for candlestick + volume evidence
 * at key levels. Rule 0: skip if not at any key level.
 */
export function evaluateBar(
  bar: Bar,
  prevBar: Bar,
  context: BarContext,
): BarEvidenceResult[] {
  const tolerance = context.avgRange || averageBarSize([bar, prevBar]);

  const keyLevels = resolveKeyLevels(
    bar.close,
    context.swingPoints,
    context.bases,
    context.indicators,
    tolerance,
  );

  // Rule 0: skip if not at any key level
  if (keyLevels.length === 0) return [];

  const volumeState = classifyVolume(bar.volume, context.avgVolume);

  // No signal without volume context
  if (volumeState === 'NORMAL') return [];

  const evidence: BarEvidenceResult[] = [];

  for (const level of keyLevels) {
    // Check violation first (highest priority)
    const violation = evaluateViolation(
      bar,
      level,
      volumeState,
      context.avgRange,
    );
    if (violation) {
      evidence.push({
        ...violation,
        isViolation: true,
        volumeState,
      });
      continue; // Skip confirmations for this level
    }

    // Dry-up: small range + volume contraction at support
    if (isDryUp(bar, context.avgRange, context.avgVolume)) {
      if (volumeState === 'CONTRACTION') {
        evidence.push({
          pattern:
            level.bias === 'BULLISH' ? 'DRY_UP' : 'RESISTANCE_DRY_UP',
          bias: level.bias,
          isViolation: false,
          keyLevelType: level.type,
          keyLevelPrice: level.price,
          volumeState,
        });
      }
    }

    // Wick absorption: long wick + volume expansion
    if (volumeState === 'EXPANSION') {
      if (isWickAbsorption(bar, level.bias)) {
        evidence.push({
          pattern:
            level.bias === 'BULLISH'
              ? 'LOWER_WICK_ABSORPTION'
              : 'UPPER_WICK_REJECTION',
          bias: level.bias,
          isViolation: false,
          keyLevelType: level.type,
          keyLevelPrice: level.price,
          volumeState,
        });
      }
    }

    // Engulfing: engulfing + volume expansion
    if (volumeState === 'EXPANSION') {
      const engulfType = isEngulfing(bar, prevBar);
      if (engulfType) {
        evidence.push({
          pattern:
            engulfType === 'BULLISH'
              ? 'BULLISH_ENGULFING'
              : 'BEARISH_ENGULFING',
          bias: engulfType,
          isViolation: false,
          keyLevelType: level.type,
          keyLevelPrice: level.price,
          volumeState,
        });
      }
    }
  }

  return evidence;
}
