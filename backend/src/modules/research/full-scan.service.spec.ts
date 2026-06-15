import { FullScanService } from './full-scan.service';

describe('FullScanService resumable steps', () => {
  it('runs from 9c through the research tail', async () => {
    const stepNames: string[] = [];
    const recorded: string[] = [];
    const ctx = {
      scanRunId: 'scan-1',
      step: jest.fn(async (name: string, fn: () => Promise<unknown>) => {
        stepNames.push(name);
        return fn();
      }),
      recordStep: jest.fn((name: string) => recorded.push(name)),
      setCounts: jest.fn(),
      note: jest.fn(),
    };
    const scanRunService = {
      run: jest.fn(async (_type: string, executor: (context: typeof ctx) => Promise<unknown>) =>
        executor(ctx),
      ),
    };
    const pipelineService = {
      isRunning: jest.fn().mockReturnValue(false),
      runFullPipeline: jest.fn().mockImplementation(async (options: {
        onStepTiming: (
          step: string,
          status: string,
          durationMs: number,
          reason?: string,
        ) => void;
      }) => {
        for (const step of ['1', '2', '3', '4', '5', '6', '7', '8', '9a', '9b']) {
          options.onStepTiming(step, 'skipped', 0, 'outside selected range');
        }
        options.onStepTiming('9c', 'ran', 1);
        options.onStepTiming('9d', 'ran', 1);
        return {
          synced: 0,
          failed: 0,
          indicatorsUpdated: 0,
          rsRanked: 0,
          completedAt: new Date(),
          durationMs: 0,
        };
      }),
    };
    const prisma = {
      stock: { count: jest.fn().mockResolvedValue(1) },
      focusListItem: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      modelReview: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            inputTokens: null,
            outputTokens: null,
            costEstimate: null,
          },
        }),
      },
    };
    const service = new FullScanService(
      prisma as any,
      pipelineService as any,
      scanRunService as any,
      { rebuild: jest.fn().mockResolvedValue(1) } as any,
      { buildWeeklyFocusList: jest.fn().mockResolvedValue({ id: 'focus-1' }) } as any,
      { enrichMissingForStocks: jest.fn() } as any,
      { generateForTheme: jest.fn() } as any,
    );

    await service.run({ fromStep: '9c' });

    expect(pipelineService.runFullPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ fromStep: '9c', toStep: '9d' }),
    );
    expect(stepNames).toEqual(['10', '11', '12']);
    expect(recorded).toEqual(expect.arrayContaining(['1', '2', '3', '4', '5', '6', '7', '8', '9a', '9b']));
  });
});
