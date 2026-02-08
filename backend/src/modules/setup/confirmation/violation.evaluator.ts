import { Bar } from '../../../common/types';
import { KeyLevel } from './key-level.resolver';
import { VolumeStateType } from '../primitives';

export interface ViolationResult {
  pattern: string;
  bias: 'BULLISH' | 'BEARISH';
  keyLevelType: string;
  keyLevelPrice: number;
}

/**
 * Evaluates if a bar is a violation at a given key level.
 *
 * Support broken: large bearish candle + volume expansion through support
 * Pivot broken: close below pivot + volume (confirms fail breakout)
 * Resistance reclaimed: volume expansion + close above resistance
 */
export function evaluateViolation(
  bar: Bar,
  level: KeyLevel,
  volumeState: VolumeStateType,
  avgRange: number,
): ViolationResult | null {
  if (volumeState !== 'EXPANSION') return null;

  const body = Math.abs(bar.close - bar.open);
  const isBearish = bar.close < bar.open;
  const isBullish = bar.close > bar.open;

  // Support broken: bearish candle with expansion through support level
  if (
    level.bias === 'BULLISH' &&
    isBearish &&
    bar.close < level.price &&
    body > avgRange * 0.8
  ) {
    const pattern =
      level.type === 'VCP_PIVOT' ? 'PIVOT_BROKEN' : 'SUPPORT_BROKEN';
    return {
      pattern,
      bias: 'BEARISH',
      keyLevelType: level.type,
      keyLevelPrice: level.price,
    };
  }

  // Resistance reclaimed: bullish candle with expansion above resistance
  if (level.bias === 'BEARISH' && isBullish && bar.close > level.price) {
    return {
      pattern: 'RESISTANCE_RECLAIMED',
      bias: 'BULLISH',
      keyLevelType: level.type,
      keyLevelPrice: level.price,
    };
  }

  return null;
}
