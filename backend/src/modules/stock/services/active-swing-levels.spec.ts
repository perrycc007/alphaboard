import { Bar } from '../../../common/types';
import {
  getActiveSwingLevelsFromBars,
  selectActiveSwingLevels,
} from './active-swing-levels';
import { SwingPointResult } from '../../setup/primitives/swing-points';

function bar(index: number, high: number, low: number, close: number): Bar {
  return {
    open: close,
    high,
    low,
    close,
    volume: 1_000_000,
    date: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
  };
}

function swing(
  index: number,
  price: number,
  type: 'HIGH' | 'LOW',
): SwingPointResult {
  return {
    index,
    price,
    type,
    atr: 1,
    prominence: 2,
  };
}

describe('active swing levels', () => {
  it('returns the nearest two active resistances and supports', () => {
    const bars = [
      bar(0, 100, 92, 96),
      bar(1, 105, 94, 99),
      bar(2, 106, 93, 100),
      bar(3, 104, 96, 100),
      bar(4, 103, 95, 100),
      bar(5, 102, 97, 100),
      bar(6, 101, 98, 100),
      bar(7, 100.5, 98.5, 100),
    ];
    const swings = [
      swing(1, 105, 'HIGH'),
      swing(3, 104, 'HIGH'),
      swing(4, 103, 'HIGH'),
      swing(5, 102, 'HIGH'),
      swing(6, 101, 'HIGH'),
      swing(1, 94, 'LOW'),
      swing(3, 96, 'LOW'),
      swing(5, 97, 'LOW'),
      swing(6, 98, 'LOW'),
    ];

    const result = selectActiveSwingLevels(bars, swings, 2);

    expect(result).toHaveLength(4);
    expect(result.map((level) => level.price)).toEqual([101, 102, 98, 97]);
    expect(result.filter((level) => level.type === 'RESISTANCE')).toHaveLength(2);
    expect(result.filter((level) => level.type === 'SUPPORT')).toHaveLength(2);
  });

  it('excludes swing highs and lows breached by later bars', () => {
    const bars = [
      bar(0, 100, 92, 96),
      bar(1, 105, 94, 99),
      bar(2, 106, 93, 100),
      bar(3, 104, 95, 100),
      bar(4, 101, 96, 100),
    ];
    const swings = [swing(1, 105, 'HIGH'), swing(1, 94, 'LOW')];

    const result = selectActiveSwingLevels(bars, swings, 2);

    expect(result).toEqual([]);
  });

  it('returns no levels when there are not enough bars for detection', () => {
    const bars = Array.from({ length: 10 }, (_, index) =>
      bar(index, 100 + index, 95 + index, 98 + index),
    );

    expect(getActiveSwingLevelsFromBars(bars)).toEqual([]);
  });
});
