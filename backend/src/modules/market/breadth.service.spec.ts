import { Prisma } from '@prisma/client';
import { BreadthService } from './breadth.service';

describe('BreadthService', () => {
  it('creates only rows returned as missing by the SQL backfill query', async () => {
    const missingRows = [
      {
        date: new Date('2026-06-12T00:00:00.000Z'),
        naad: new Prisma.Decimal(10),
        naa50r: new Prisma.Decimal(55.5),
        naa200r: new Prisma.Decimal(47.25),
        nahl: new Prisma.Decimal(3),
      },
    ];
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue(missingRows),
      breadthSnapshot: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const service = new BreadthService(prisma as any);

    const result = await service.backfillMissing(5);

    expect(result.created).toBe(1);
    expect(prisma.breadthSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        {
          date: missingRows[0].date,
          naad: missingRows[0].naad,
          naa50r: missingRows[0].naa50r,
          naa200r: missingRows[0].naa200r,
          nahl: missingRows[0].nahl,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('does not write when there are no missing breadth dates', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      breadthSnapshot: {
        createMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const service = new BreadthService(prisma as any);

    const result = await service.backfillMissing(5);

    expect(result.created).toBe(0);
    expect(prisma.breadthSnapshot.createMany).not.toHaveBeenCalled();
  });

  it('supports year-based chart ranges', async () => {
    const prisma = {
      breadthSnapshot: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new BreadthService(prisma as any);

    await service.getTimeSeries('5y');

    expect(prisma.breadthSnapshot.findMany).toHaveBeenCalledWith({
      where: { date: { gte: expect.any(Date) } },
      orderBy: { date: 'asc' },
    });
  });
});
