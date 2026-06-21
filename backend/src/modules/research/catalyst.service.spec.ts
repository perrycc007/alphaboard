import { Direction, SetupState, StageEnum, StockCategory } from '@prisma/client';
import { CatalystService } from './catalyst.service';

describe('CatalystService technical verification', () => {
  const baseCatalyst = {
    id: 'cat-1',
    title: 'AI demand',
    hypothesis: 'NVDA benefits while OLDHW is hurt.',
    themeId: null,
    groupId: null,
    expectedBeneficiariesJson: ['NVDA', 'AMD'],
    expectedLosersJson: [],
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      catalystHypothesis: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...baseCatalyst,
          ...overrides,
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'cat-1',
          ...data,
        })),
      },
      stock: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'stock-1', ticker: 'NVDA', name: 'NVIDIA Corporation' },
          { id: 'stock-2', ticker: 'OLDHW', name: 'Old Hardware Inc.' },
          { id: 'stock-3', ticker: 'AMD', name: 'Advanced Micro Devices' },
        ]),
      },
      setup: {
        findMany: jest.fn(),
      },
      stockStage: {
        findMany: jest.fn().mockResolvedValue([
          {
            stockId: 'stock-1',
            stage: StageEnum.STAGE_2,
            category: StockCategory.HOT,
            date: new Date('2026-06-19'),
          },
          {
            stockId: 'stock-3',
            stage: StageEnum.STAGE_2,
            category: StockCategory.NONE,
            date: new Date('2026-06-19'),
          },
        ]),
      },
      themeStock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    return {
      prisma,
      service: new CatalystService(prisma as any, {} as any),
    };
  }

  it('marks catalysts aligned when affected stocks cluster long', async () => {
    const { prisma, service } = createService();
    prisma.setup.findMany.mockResolvedValue([
      {
        stockId: 'stock-1',
        type: 'BREAKOUT_PIVOT',
        state: SetupState.READY,
        direction: Direction.LONG,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-19'),
      },
      {
        stockId: 'stock-3',
        type: 'PULLBACK_BUY',
        state: SetupState.BUILDING,
        direction: Direction.LONG,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-18'),
      },
    ]);

    await service.verify('cat-1');

    const verification =
      prisma.catalystHypothesis.update.mock.calls[0][0].data
        .technicalVerificationJson;
    expect(verification.verdict).toBe('ALIGNED');
    expect(verification.themeCondition).toBe('SETUP_LONG');
    expect(verification.setupSide).toBe(Direction.LONG);
    expect(verification.stageHealth.stageCounts.STAGE_2).toBe(2);
    expect(verification.counts).toMatchObject({
      checked: 2,
      aligned: 2,
      withSetup: 2,
      longSetups: 2,
      shortSetups: 0,
    });
    const nvda = verification.affectedStocks.find(
      (stock: { ticker: string }) => stock.ticker === 'NVDA',
    );
    expect(nvda).toMatchObject({
      stage: StageEnum.STAGE_2,
      category: StockCategory.HOT,
      stockStatus: 'Healthy Stage 2 / HOT',
      setupDirection: Direction.LONG,
      aligned: true,
    });
  });

  it('marks catalysts aligned when affected stocks cluster short even if listed as beneficiaries', async () => {
    const { prisma, service } = createService();
    prisma.setup.findMany.mockResolvedValue([
      {
        stockId: 'stock-1',
        type: 'DOUBLE_TOP',
        state: SetupState.READY,
        direction: Direction.SHORT,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-19'),
      },
      {
        stockId: 'stock-3',
        type: 'FAIL_BREAKOUT',
        state: SetupState.TRIGGERED,
        direction: Direction.SHORT,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-18'),
      },
    ]);

    await service.verify('cat-1');

    const verification =
      prisma.catalystHypothesis.update.mock.calls[0][0].data
        .technicalVerificationJson;
    expect(verification.verdict).toBe('ALIGNED');
    expect(verification.themeCondition).toBe('SETUP_SHORT');
    expect(verification.setupSide).toBe(Direction.SHORT);
    expect(verification.counts).toMatchObject({
      checked: 2,
      aligned: 2,
      withSetup: 2,
      longSetups: 0,
      shortSetups: 2,
    });
  });

  it('marks loser stocks aligned when their setups join the group short side', async () => {
    const { prisma, service } = createService({
      expectedBeneficiariesJson: [],
      expectedLosersJson: ['OLDHW', 'NVDA'],
    });
    prisma.setup.findMany.mockResolvedValue([
      {
        stockId: 'stock-2',
        type: 'FAIL_BREAKOUT',
        state: SetupState.TRIGGERED,
        direction: Direction.SHORT,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-19'),
      },
      {
        stockId: 'stock-1',
        type: 'DOUBLE_TOP',
        state: SetupState.READY,
        direction: Direction.SHORT,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-18'),
      },
    ]);

    await service.verify('cat-1');

    const verification =
      prisma.catalystHypothesis.update.mock.calls[0][0].data
        .technicalVerificationJson;
    expect(verification.verdict).toBe('ALIGNED');
    expect(verification.themeCondition).toBe('SETUP_SHORT');
    expect(verification.setupSide).toBe(Direction.SHORT);
    expect(verification.affectedStocks[0]).toMatchObject({
      role: 'LOSER',
      setupDirection: Direction.SHORT,
      aligned: true,
    });
  });

  it('marks mixed when active setups do not cluster to one side', async () => {
    const { prisma, service } = createService();
    prisma.setup.findMany.mockResolvedValue([
      {
        stockId: 'stock-1',
        type: 'DOUBLE_TOP',
        state: SetupState.READY,
        direction: Direction.SHORT,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-19'),
      },
      {
        stockId: 'stock-3',
        type: 'BREAKOUT_PIVOT',
        state: SetupState.READY,
        direction: Direction.LONG,
        pivotPrice: null,
        stopPrice: null,
        targetPrice: null,
        detectedAt: new Date('2026-06-18'),
      },
    ]);

    await service.verify('cat-1');

    const verification =
      prisma.catalystHypothesis.update.mock.calls[0][0].data
        .technicalVerificationJson;
    expect(verification.verdict).toBe('NOT_ALIGNED');
    expect(verification.themeCondition).toBe('HEALTHY_STAGE_2');
    expect(verification.setupSide).toBeNull();
    expect(verification.counts).toMatchObject({
      aligned: 0,
      withSetup: 2,
      longSetups: 1,
      shortSetups: 1,
    });
  });

  it('reports healthy theme condition when affected stocks have no setup but are mostly stage 2', async () => {
    const { prisma, service } = createService();
    prisma.setup.findMany.mockResolvedValue([]);

    await service.verify('cat-1');

    const verification =
      prisma.catalystHypothesis.update.mock.calls[0][0].data
        .technicalVerificationJson;
    expect(verification.verdict).toBe('NO_SETUP_EVIDENCE');
    expect(verification.themeCondition).toBe('HEALTHY_STAGE_2');
    expect(verification.summary).toContain('the group is healthy');
    expect(verification.stageHealth).toMatchObject({
      stage2Share: 1,
      constructiveShare: 1,
      weakShare: 0,
    });
    expect(verification.counts).toEqual({
      checked: 2,
      aligned: 0,
      mismatched: 0,
      missingSetup: 2,
      withSetup: 0,
      longSetups: 0,
      shortSetups: 0,
    });
  });
});
