import { Bar } from '../../../common/types';

/**
 * Dry-Up: small range + low volume at key level.
 * Range < 0.6 * avgRange AND Volume < 0.6 * avgVolume
 */
export function isDryUp(
  bar: Bar,
  avgRange: number,
  avgVolume: number,
): boolean {
  const range = bar.high - bar.low;
  return range < 0.6 * avgRange && bar.volume < 0.6 * avgVolume;
}

/**
 * Wick Absorption: long wick + volume expansion at key level.
 * Bullish: LowerWick > 2 * Body, UpperWick < Body
 * Bearish: UpperWick > 2 * Body, LowerWick < Body
 */
export function isWickAbsorption(
  bar: Bar,
  bias: 'BULLISH' | 'BEARISH',
): boolean {
  const body = Math.abs(bar.close - bar.open);
  if (body === 0) return false;
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;

  if (bias === 'BULLISH') {
    return lowerWick > 2 * body && upperWick < body;
  }
  return upperWick > 2 * body && lowerWick < body;
}

/**
 * Engulfing: current body fully engulfs previous body.
 */
export function isEngulfing(
  current: Bar,
  previous: Bar,
): 'BULLISH' | 'BEARISH' | null {
  const currOpen = current.open;
  const currClose = current.close;
  const prevOpen = previous.open;
  const prevClose = previous.close;

  const currBodyHigh = Math.max(currOpen, currClose);
  const currBodyLow = Math.min(currOpen, currClose);
  const prevBodyHigh = Math.max(prevOpen, prevClose);
  const prevBodyLow = Math.min(prevOpen, prevClose);

  if (currBodyHigh > prevBodyHigh && currBodyLow < prevBodyLow) {
    return currClose > currOpen ? 'BULLISH' : 'BEARISH';
  }
  return null;
}
