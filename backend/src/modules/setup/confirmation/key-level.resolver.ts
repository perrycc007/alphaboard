export interface KeyLevel {
  type: string;
  price: number;
  bias: 'BULLISH' | 'BEARISH';
}

interface SwingPointInput {
  type: string;
  price: number;
}

interface DailyBaseInput {
  peakPrice: number;
  baseLow: number;
  pivotPrice?: number | null;
}

interface IndicatorInput {
  sma20?: number;
  sma50?: number;
  sma200?: number;
  vwap?: number;
}

/**
 * Finds the nearest key level(s) for a given bar price.
 * Key levels: SwingHigh, SwingLow, BaseLow, BaseHigh, VcpPivot, MA20, MA50, MA200, VWAP
 */
export function resolveKeyLevels(
  price: number,
  swingPoints: SwingPointInput[],
  bases: DailyBaseInput[],
  indicators: IndicatorInput,
  tolerance: number,
): KeyLevel[] {
  const levels: KeyLevel[] = [];

  // Swing points
  for (const sp of swingPoints) {
    if (Math.abs(price - sp.price) <= tolerance) {
      levels.push({
        type: sp.type === 'HIGH' ? 'SWING_HIGH' : 'SWING_LOW',
        price: sp.price,
        bias: sp.type === 'HIGH' ? 'BEARISH' : 'BULLISH',
      });
    }
  }

  // Base levels
  for (const base of bases) {
    if (Math.abs(price - base.baseLow) <= tolerance) {
      levels.push({ type: 'BASE_LOW', price: base.baseLow, bias: 'BULLISH' });
    }
    if (Math.abs(price - base.peakPrice) <= tolerance) {
      levels.push({
        type: 'BASE_HIGH',
        price: base.peakPrice,
        bias: 'BEARISH',
      });
    }
    if (base.pivotPrice && Math.abs(price - base.pivotPrice) <= tolerance) {
      levels.push({
        type: 'VCP_PIVOT',
        price: base.pivotPrice,
        bias: 'BULLISH',
      });
    }
  }

  // Moving averages
  if (indicators.sma20 && Math.abs(price - indicators.sma20) <= tolerance) {
    levels.push({
      type: 'MA_20',
      price: indicators.sma20,
      bias: price > indicators.sma20 ? 'BULLISH' : 'BEARISH',
    });
  }
  if (indicators.sma50 && Math.abs(price - indicators.sma50) <= tolerance) {
    levels.push({
      type: 'MA_50',
      price: indicators.sma50,
      bias: price > indicators.sma50 ? 'BULLISH' : 'BEARISH',
    });
  }
  if (indicators.sma200 && Math.abs(price - indicators.sma200) <= tolerance) {
    levels.push({
      type: 'MA_200',
      price: indicators.sma200,
      bias: price > indicators.sma200 ? 'BULLISH' : 'BEARISH',
    });
  }
  if (indicators.vwap && Math.abs(price - indicators.vwap) <= tolerance) {
    levels.push({
      type: 'VWAP',
      price: indicators.vwap,
      bias: price > indicators.vwap ? 'BULLISH' : 'BEARISH',
    });
  }

  return levels;
}
