import {
  Direction,
  KeyLevelType,
  Prisma,
  SetupState,
  SetupType,
  StageEnum,
  TimingSignalType,
} from '@prisma/client';
import { LeaderPeriodSnapshotService } from './leader-period-snapshot.service';
import type {
  LeaderRunWithStock,
  LeaderSnapshotContext,
} from './market-regime.types';

describe('LeaderPeriodSnapshotService', () => {
  const service = new LeaderPeriodSnapshotService();

  it('builds snapshots with identified setup labels and stage-3/4 short gating', () => {
    const startDate = new Date('2026-01-08T00:00:00.000Z');
    const endDate = new Date('2026-01-10T00:00:00.000Z');

    const run = {
      id: 'run_1',
      stockId: 'stock_1',
      stage2StartDate: new Date('2025-01-01T00:00:00.000Z'),
      stage2EndDate: new Date('2025-06-01T00:00:00.000Z'),
      entryPrice: new Prisma.Decimal(10),
      peakPrice: new Prisma.Decimal(24),
      peakGainPct: new Prisma.Decimal(140),
      isQualified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      stock: {
        id: 'stock_1',
        ticker: 'AAA',
        name: 'Alpha',
      },
    } as unknown as LeaderRunWithStock;

    const context: LeaderSnapshotContext = {
      runs: [run],
      stagesByStock: new Map([
        [
          'stock_1',
          [
            { stockId: 'stock_1', date: endDate, stage: StageEnum.STAGE_3 },
            {
              stockId: 'stock_1',
              date: new Date('2025-12-01T00:00:00.000Z'),
              stage: StageEnum.STAGE_2,
            },
          ],
        ],
      ]),
      setupsByStock: new Map([
        [
          'stock_1',
          [
            {
              stockId: 'stock_1',
              type: SetupType.DOUBLE_TOP,
              state: SetupState.READY,
              direction: Direction.SHORT,
              detectedAt: new Date('2026-01-09T00:00:00.000Z'),
            },
          ],
        ],
      ]),
      timingByStock: new Map([
        [
          'stock_1',
          [
            {
              stockId: 'stock_1',
              type: TimingSignalType.DOUBLE_TOP_REJECTION,
              direction: Direction.SHORT,
              signalAt: new Date('2026-01-09T10:00:00.000Z'),
              levelType: KeyLevelType.SWING_HIGH,
              referenceLevel: new Prisma.Decimal(20),
              triggerPrice: new Prisma.Decimal(19.5),
              stopPrice: new Prisma.Decimal(20.3),
            },
          ],
        ],
      ]),
      barsByStock: new Map([
        [
          'stock_1',
          [
            {
              stockId: 'stock_1',
              date: new Date('2026-01-08T00:00:00.000Z'),
              close: 20,
            },
            {
              stockId: 'stock_1',
              date: new Date('2026-01-10T00:00:00.000Z'),
              close: 18,
            },
          ],
        ],
      ]),
    };

    const result = service.buildFromContext(startDate, endDate, context);

    expect(result.summary).toHaveLength(1);
    expect(result.summary[0].identifiedSetupLabel).toBe('Double Top Ready / SHORT');
    expect(result.summary[0].shortingEnabled).toBe(true);
    expect(result.snapshots[0].setupCount).toBe(1);
    expect(result.snapshots[0].timingSignalCount).toBe(1);
  });
});
