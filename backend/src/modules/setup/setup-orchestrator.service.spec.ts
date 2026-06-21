import { Direction, SetupType, StageEnum, Timeframe } from '@prisma/client';
import { SetupOrchestratorService } from './setup-orchestrator.service';

const bars = Array.from({ length: 60 }, (_, index) => ({
  open: 10 + index * 0.1,
  high: 11 + index * 0.1,
  low: 9 + index * 0.1,
  close: 10.5 + index * 0.1,
  volume: 300_000,
  date: new Date(`2026-01-${String((index % 28) + 1).padStart(2, '0')}`),
}));

describe('SetupOrchestratorService audit result', () => {
  function makeService(detected: any[]) {
    const service = new SetupOrchestratorService(
      {} as any,
      {} as any,
      { detectDailySignals: jest.fn().mockResolvedValue(detected) } as any,
    );
    (service as any).buildDailyContext = jest.fn().mockResolvedValue({
      stockId: 'stock-1',
      isStage2: true,
      canShortLeader: true,
      activeSetups: [],
      activeBases: [],
      keyLevels: [],
    });
    (service as any).persistSetup = jest.fn().mockResolvedValue({
      outcome: 'created',
      setup: {
        setupId: 'setup-1',
        type: SetupType.VCP,
        direction: Direction.LONG,
        timeframe: Timeframe.DAILY,
      },
    });
    (service as any).updateDailySetupStates = jest.fn().mockResolvedValue(undefined);
    (service as any).expireStaleSetups = jest.fn().mockResolvedValue(undefined);
    return service;
  }

  it('returns created setup details from python detection', async () => {
    const service = makeService([
      {
        type: SetupType.VCP,
        direction: Direction.LONG,
        timeframe: Timeframe.DAILY,
        pivotPrice: 20,
        evidence: ['tight closes'],
      },
    ]);

    const result = await service.runDailyDetection('stock-1', bars);

    expect(result.detectorSource).toBe('python');
    expect(result.created).toEqual([
      expect.objectContaining({
        setupId: 'setup-1',
        type: SetupType.VCP,
        direction: Direction.LONG,
        timeframe: Timeframe.DAILY,
        detectorSource: 'python',
      }),
    ]);
    expect(result.deduped).toEqual([]);
    expect(result.suppressed).toEqual([]);
  });

  it('returns suppressed short setups when shorting is not allowed', async () => {
    const service = makeService([
      {
        type: SetupType.DOUBLE_TOP,
        direction: Direction.SHORT,
        timeframe: Timeframe.DAILY,
      },
    ]);
    (service as any).buildDailyContext.mockResolvedValueOnce({
      stockId: 'stock-1',
      isStage2: false,
      canShortLeader: false,
      activeSetups: [],
      activeBases: [],
      keyLevels: [],
    });

    const result = await service.runDailyDetection('stock-1', bars);

    expect((service as any).persistSetup).not.toHaveBeenCalled();
    expect(result.suppressed).toEqual([
      expect.objectContaining({
        type: SetupType.DOUBLE_TOP,
        direction: Direction.SHORT,
        reason: 'SHORT_NOT_ALLOWED',
      }),
    ]);
  });
});

describe('SetupOrchestratorService simulated reversal outcomes', () => {
  function makeSimulationBars(
    scenarioBars: Array<{
      high: number;
      low: number;
      close: number;
    }>,
  ) {
    const warmup = Array.from({ length: 50 }, (_, index) => ({
      open: 100,
      high: 101.5,
      low: 98.5,
      close: 100,
      volume: 300_000,
      date: new Date(Date.UTC(2026, 0, index + 1)),
      sma50: 99,
      sma200: 90,
      atr14: 3,
    }));
    return [
      ...warmup,
      ...scenarioBars.map((bar, index) => ({
        open: 100,
        volume: 300_000,
        date: new Date(Date.UTC(2026, 2, index + 1)),
        sma50: 99,
        sma200: 90,
        atr14: 3,
        ...bar,
      })),
    ];
  }

  function makeSimulationService({
    dailyBars,
    detected,
    triggerDate,
    canShort = false,
  }: {
    dailyBars: ReturnType<typeof makeSimulationBars>;
    detected: any;
    triggerDate: Date;
    canShort?: boolean;
  }) {
    const prisma = {
      stock: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'stock-1', ticker: 'TST' }),
      },
      stockDaily: {
        findMany: jest.fn().mockResolvedValue(dailyBars),
      },
      stockStage: {
        findMany: jest.fn().mockResolvedValue(
          canShort
            ? [
                {
                  stockId: 'stock-1',
                  date: new Date(Date.UTC(2026, 1, 1)),
                  stage: StageEnum.STAGE_3,
                },
              ]
            : [],
        ),
      },
      leaderRun: {
        findMany: jest.fn().mockResolvedValue(
          canShort
            ? [
                {
                  stockId: 'stock-1',
                  stage2EndDate: new Date(Date.UTC(2026, 1, 1)),
                  isQualified: true,
                },
              ]
            : [],
        ),
      },
    };
    const service = new SetupOrchestratorService(
      prisma as any,
      {} as any,
      {} as any,
    );
    (service as any).dailyDetectors = [
      {
        detect: jest.fn((windowBars: typeof dailyBars) => {
          const latest = windowBars[windowBars.length - 1];
          return latest.date.getTime() === triggerDate.getTime() ? detected : null;
        }),
      },
    ];
    return service;
  }

  it('uses trigger-day low as long reversal stop and computes maxR from risk', async () => {
    const dailyBars = makeSimulationBars([
      { high: 101, low: 96, close: 100.5 },
      { high: 112, low: 101, close: 110 },
    ]);
    const service = makeSimulationService({
      dailyBars,
      triggerDate: dailyBars[50].date,
      detected: {
        type: SetupType.UNDERCUT_RALLY,
        direction: Direction.LONG,
        timeframe: Timeframe.DAILY,
        pivotPrice: 100,
        stopPrice: 90,
      },
    });

    const result = await service.simulateDetection('TST');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        entryPrice: 100,
        actualStopPrice: 96,
        riskAmount: 4,
      }),
    );
    expect(result[0].maxR).toBeCloseTo(3);
    expect(result[0].rTargets['2'].hit).toBe(true);
    expect(result[0].rTargets['3'].hit).toBe(true);
  });

  it('uses trigger-day high as short reversal stop and computes maxR from risk', async () => {
    const dailyBars = makeSimulationBars([
      { high: 104, low: 99, close: 99.5 },
      { high: 99, low: 88, close: 90 },
    ]);
    const service = makeSimulationService({
      dailyBars,
      canShort: true,
      triggerDate: dailyBars[50].date,
      detected: {
        type: SetupType.DOUBLE_TOP,
        direction: Direction.SHORT,
        timeframe: Timeframe.DAILY,
        pivotPrice: 100,
        stopPrice: 120,
      },
    });

    const result = await service.simulateDetection('TST');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        entryPrice: 100,
        actualStopPrice: 104,
        riskAmount: 4,
      }),
    );
    expect(result[0].maxR).toBeCloseTo(3);
    expect(result[0].rTargets['3'].hit).toBe(true);
  });

  it('excludes reversal outcomes when risk is not greater than average bar range', async () => {
    const dailyBars = makeSimulationBars([
      { high: 101, low: 98, close: 100.5 },
      { high: 112, low: 101, close: 110 },
    ]);
    const service = makeSimulationService({
      dailyBars,
      triggerDate: dailyBars[50].date,
      detected: {
        type: SetupType.UNDERCUT_RALLY,
        direction: Direction.LONG,
        timeframe: Timeframe.DAILY,
        pivotPrice: 100,
        stopPrice: 90,
      },
    });

    const result = await service.simulateDetection('TST');

    expect(result).toEqual([]);
  });

  it('does not count favorable movement from a bar that hits the stop first', async () => {
    const dailyBars = makeSimulationBars([
      { high: 101, low: 96, close: 100.5 },
      { high: 112, low: 95, close: 97 },
    ]);
    const service = makeSimulationService({
      dailyBars,
      triggerDate: dailyBars[50].date,
      detected: {
        type: SetupType.UNDERCUT_RALLY,
        direction: Direction.LONG,
        timeframe: Timeframe.DAILY,
        pivotPrice: 100,
        stopPrice: 90,
      },
    });

    const result = await service.simulateDetection('TST');

    expect(result).toHaveLength(1);
    expect(result[0].stopHit.hit).toBe(true);
    expect(result[0].finalR).toBe(-1);
    expect(result[0].maxR).toBeNull();
    expect(result[0].rTargets['2'].hit).toBe(false);
  });
});
