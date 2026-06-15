import { SetupType } from '@prisma/client';
import { MarketRegimeService } from './market-regime.service';

describe('MarketRegimeService setup outcomes rebuild', () => {
  it('persists simulated outcomes in stock batches without building one giant array', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 100 });
    const stocks = Array.from({ length: 250 }, (_, index) => ({
      id: `stock-${index}`,
      ticker: `T${index}`,
    }));
    const prisma = {
      setupOutcome: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany,
      },
      setup: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      stock: {
        findMany: jest.fn().mockResolvedValue(stocks),
      },
    };
    const orchestrator = {
      simulateDetection: jest.fn().mockResolvedValue([
        {
          type: SetupType.BREAKOUT_PIVOT,
          direction: 'LONG',
          detectedAt: '2026-06-12T00:00:00.000Z',
          entryDate: '2026-06-13T00:00:00.000Z',
          exitDate: '2026-06-20T00:00:00.000Z',
          actualStopPrice: 95,
          entryPrice: 100,
          exitPrice: 110,
          maxR: 2,
          finalR: 1.5,
          state: 'EXPIRED',
          holdingDays: 7,
        },
      ]),
    };
    const service = new MarketRegimeService(
      prisma as any,
      {} as any,
      {} as any,
      orchestrator as any,
      {} as any,
      {} as any,
    );

    const count = await service.rebuildSetupOutcomes();

    expect(count).toBe(250);
    expect(orchestrator.simulateDetection).toHaveBeenCalledTimes(250);
    expect(createMany).toHaveBeenCalledTimes(3);
    expect(createMany.mock.calls.map(([arg]) => arg.data.length)).toEqual([
      100,
      100,
      50,
    ]);
  });
});
