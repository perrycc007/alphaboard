import { SetupType, Timeframe } from '@prisma/client';
import type { Bar } from '../../../../common/types';
import type { DailyDetectorContext } from '../detector.interface';
import type { SwingPointResult } from '../../primitives';
import { Ema20PullbackDetector } from './ema20-pullback.detector';
import { MaRallyFailureDetector } from './ma-rally-failure.detector';
import { DoubleTopDetector } from './double-top.detector';

function buildDate(day: number): Date {
  return new Date(Date.UTC(2024, 0, day));
}

function buildBar(
  close: number,
  {
    high = close + 2,
    low = close - 2,
    open = close - 1,
    volume = 100,
    day = 1,
  }: {
    high?: number;
    low?: number;
    open?: number;
    volume?: number;
    day?: number;
  } = {},
): Bar {
  return {
    open,
    high,
    low,
    close,
    volume,
    date: buildDate(day),
  };
}

function buildContext(
  overrides: Partial<DailyDetectorContext> = {},
): DailyDetectorContext {
  return {
    stockId: 'stock-1',
    isStage2: true,
    sma50: 95,
    sma200: 85,
    ema20: 100,
    atr14: 5,
    avgVolume: 120,
    activeBases: [],
    activeSetups: [],
    keyLevels: [],
    regime: 'TREND',
    ...overrides,
  };
}

describe('precision-first daily detectors', () => {
  it('rejects EMA20 pullback signals when the breakout anchor is stale', () => {
    const detector = new Ema20PullbackDetector();
    const bars: Bar[] = [
      buildBar(90, { day: 1 }),
      buildBar(92, { day: 2 }),
      buildBar(94, { day: 3 }),
      buildBar(96, { day: 4 }),
      buildBar(98, { day: 5 }),
      buildBar(101, { day: 6 }),
      buildBar(104, { day: 7 }),
      buildBar(107, { day: 8 }),
      buildBar(111, { day: 9 }),
      buildBar(115, { day: 10 }),
      buildBar(114, { day: 11 }),
      buildBar(113, { day: 12 }),
      buildBar(112, { day: 13 }),
      buildBar(111, { day: 14 }),
      buildBar(110, { day: 15 }),
      buildBar(109, { day: 16 }),
      buildBar(108.5, { high: 110, low: 106.5, volume: 80, day: 17 }),
      buildBar(107.2, { high: 109, low: 104.8, volume: 75, day: 18 }),
      buildBar(101.5, { high: 102, low: 99, open: 100.2, volume: 70, day: 19 }),
      buildBar(101.4, { high: 101.8, low: 99.4, open: 100.6, volume: 68, day: 20 }),
    ];

    const activeSetup = {
      id: 'setup-1',
      type: SetupType.BREAKOUT_PIVOT,
      state: 'TRIGGERED',
      direction: 'LONG' as const,
      timeframe: Timeframe.DAILY,
      pivotPrice: 96,
      detectedAt: buildDate(9),
      lastStateAt: buildDate(9),
    };

    const fresh = detector.detect(
      bars,
      [],
      buildContext({ activeSetups: [activeSetup] }),
    );
    const stale = detector.detect(
      bars,
      [],
      buildContext({
        activeSetups: [
          {
            ...activeSetup,
            detectedAt: new Date(Date.UTC(2023, 10, 1)),
            lastStateAt: new Date(Date.UTC(2023, 10, 1)),
          },
        ],
      }),
    );

    expect(fresh).not.toBeNull();
    expect(stale).toBeNull();
  });

  it('requires a recent failure anchor for MA rally failure setups', () => {
    const detector = new MaRallyFailureDetector();
    const bars: Bar[] = [
      buildBar(104, { day: 1 }),
      buildBar(101, { day: 2 }),
      buildBar(99, { day: 3 }),
      buildBar(97, { day: 4 }),
      buildBar(96, { day: 5 }),
      buildBar(95, { day: 6 }),
      buildBar(96, { day: 7 }),
      buildBar(95.5, { day: 8 }),
      buildBar(96.2, { day: 9 }),
      buildBar(95.1, { day: 10 }),
      buildBar(96, { day: 11 }),
      buildBar(95.3, { day: 12 }),
      buildBar(96.1, { day: 13 }),
      buildBar(95.4, { high: 99.7, low: 94.8, volume: 90, day: 14 }),
      buildBar(95.1, { high: 100.3, low: 94.6, open: 99.4, volume: 92, day: 15 }),
    ];

    const activeFailure = {
      id: 'fail-1',
      type: SetupType.FAIL_BASE,
      state: 'TRIGGERED',
      direction: 'SHORT' as const,
      timeframe: Timeframe.DAILY,
      pivotPrice: 100,
      detectedAt: buildDate(10),
      lastStateAt: buildDate(10),
    };

    const fresh = detector.detect(
      bars,
      [],
      buildContext({
        regime: 'FAILURE',
        isStage2: false,
        sma50: 100,
        ema20: 95.5,
        atr14: 4,
        avgVolume: 100,
        activeSetups: [activeFailure],
      }),
    );
    const stale = detector.detect(
      bars,
      [],
      buildContext({
        regime: 'FAILURE',
        isStage2: false,
        sma50: 100,
        ema20: 95.5,
        atr14: 4,
        avgVolume: 100,
        activeSetups: [
          {
            ...activeFailure,
            detectedAt: new Date(Date.UTC(2023, 10, 1)),
            lastStateAt: new Date(Date.UTC(2023, 10, 1)),
          },
        ],
      }),
    );

    expect(fresh).not.toBeNull();
    expect(stale).toBeNull();
  });

  it('requires a real failed close for a DOUBLE_TOP trigger', () => {
    const detector = new DoubleTopDetector();
    const swingPoints: SwingPointResult[] = [
      { index: 5, price: 100, type: 'HIGH', atr: 2, prominence: 3 },
      { index: 12, price: 90, type: 'LOW', atr: 2, prominence: 3 },
    ];
    const bars: Bar[] = Array.from({ length: 25 }, (_, index) =>
      buildBar(94 + index * 0.2, {
        high: 95 + index * 0.2,
        low: 93 + index * 0.2,
        day: index + 1,
      }),
    );

    bars[24] = buildBar(98, {
      high: 103,
      low: 97,
      open: 101.5,
      volume: 120,
      day: 25,
    });

    const triggered = detector.detect(
      bars,
      swingPoints,
      buildContext({
        isStage2: false,
        regime: 'FAILURE',
        atr14: 2,
      }),
    );

    bars[24] = buildBar(100.6, {
      high: 103,
      low: 99,
      open: 101.2,
      volume: 120,
      day: 25,
    });

    const strongClose = detector.detect(
      bars,
      swingPoints,
      buildContext({
        isStage2: false,
        regime: 'FAILURE',
        atr14: 2,
      }),
    );

    expect(triggered?.type).toBe(SetupType.DOUBLE_TOP);
    expect(strongClose).toBeNull();
  });
});
