import { Bar } from '../../../common/types';
import {
  detectSignificantSwingPoints,
  SwingPointResult,
} from '../../setup/primitives/swing-points';

export type ActiveSwingLevelType = 'RESISTANCE' | 'SUPPORT';
export type ActiveSwingLevelSource = 'SWING_HIGH' | 'SWING_LOW';

export interface ActiveSwingLevel {
  type: ActiveSwingLevelType;
  source: ActiveSwingLevelSource;
  price: number;
  pivotDate: string;
  prominence: number;
  distancePct: number;
}

function toPivotDate(bar: Bar | undefined): string {
  const value = bar?.date ?? bar?.timestamp;
  return value instanceof Date ? value.toISOString() : '';
}

function isSwingStillActive(
  swing: SwingPointResult,
  bars: Bar[],
): boolean {
  const futureBars = bars.slice(swing.index + 1);
  if (swing.type === 'HIGH') {
    return !futureBars.some((bar) => bar.high > swing.price);
  }
  return !futureBars.some((bar) => bar.low < swing.price);
}

export function selectActiveSwingLevels(
  bars: Bar[],
  swingPoints: SwingPointResult[],
  maxPerSide = 2,
): ActiveSwingLevel[] {
  if (bars.length === 0) return [];

  const latestClose = bars[bars.length - 1].close;
  if (!Number.isFinite(latestClose) || latestClose <= 0) return [];

  const levels = swingPoints
    .filter((swing) => swing.index >= 0 && swing.index < bars.length)
    .filter((swing) => isSwingStillActive(swing, bars))
    .map((swing): ActiveSwingLevel | null => {
      if (swing.type === 'HIGH' && swing.price > latestClose) {
        return {
          type: 'RESISTANCE',
          source: 'SWING_HIGH',
          price: swing.price,
          pivotDate: toPivotDate(bars[swing.index]),
          prominence: swing.prominence,
          distancePct: ((swing.price - latestClose) / latestClose) * 100,
        };
      }

      if (swing.type === 'LOW' && swing.price < latestClose) {
        return {
          type: 'SUPPORT',
          source: 'SWING_LOW',
          price: swing.price,
          pivotDate: toPivotDate(bars[swing.index]),
          prominence: swing.prominence,
          distancePct: ((latestClose - swing.price) / latestClose) * 100,
        };
      }

      return null;
    })
    .filter((level): level is ActiveSwingLevel => level != null);

  const resistances = levels
    .filter((level) => level.type === 'RESISTANCE')
    .sort((a, b) => a.distancePct - b.distancePct)
    .slice(0, maxPerSide);

  const supports = levels
    .filter((level) => level.type === 'SUPPORT')
    .sort((a, b) => a.distancePct - b.distancePct)
    .slice(0, maxPerSide);

  return [...resistances, ...supports];
}

export function getActiveSwingLevelsFromBars(
  bars: Bar[],
  maxPerSide = 2,
): ActiveSwingLevel[] {
  if (bars.length < 20) return [];

  const swingPoints = detectSignificantSwingPoints(bars);
  return selectActiveSwingLevels(bars, swingPoints, maxPerSide);
}
