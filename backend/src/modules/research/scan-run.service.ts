import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ScanRun, ScanRunType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PipelineStepStatus,
  PipelineStepTiming,
} from '../data-ingestion/services/pipeline-steps';

/**
 * Mutable counts a pipeline step can report while a scan run is in progress.
 * Everything optional so a step only sets what it knows about.
 */
export interface ScanRunCounts {
  stockCount?: number;
  candidateCount?: number;
  focusListCount?: number;
  modelInputTokens?: number;
  modelOutputTokens?: number;
  modelCostEstimate?: number;
}

/**
 * Handle passed to a scan-run executor. Used to time individual steps and
 * report counts/notes that get persisted when the run finalizes.
 */
export class ScanRunContext {
  private readonly stepTimings: Record<string, PipelineStepTiming> = {};
  private readonly counts: ScanRunCounts = {};
  private noteText?: string;

  constructor(readonly scanRunId: string) {}

  /** Time a single named step and record its duration in milliseconds. */
  async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.recordStep(name, 'ran', Date.now() - start);
    }
  }

  recordStep(
    name: string,
    status: PipelineStepStatus,
    durationMs = 0,
    reason?: string,
  ): void {
    this.stepTimings[name] = {
      status,
      durationMs,
      ...(reason ? { reason } : {}),
    };
  }

  /** Merge reported counts into the run. Later values overwrite earlier ones. */
  setCounts(counts: ScanRunCounts): void {
    Object.assign(this.counts, counts);
  }

  note(text: string): void {
    this.noteText = text;
  }

  getStepTimings(): Record<string, PipelineStepTiming> {
    return this.stepTimings;
  }

  getCounts(): ScanRunCounts {
    return this.counts;
  }

  getNote(): string | undefined {
    return this.noteText;
  }
}

/**
 * Wraps every research pipeline step in a measured `ScanRun` record so
 * bottlenecks and model costs can be inspected before optimizing.
 */
@Injectable()
export class ScanRunService {
  private readonly logger = new Logger(ScanRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a RUNNING scan run, execute the work, and finalize it as
   * COMPLETED or FAILED with timing, counts, and step durations recorded.
   */
  async run<T>(
    type: ScanRunType,
    executor: (ctx: ScanRunContext) => Promise<T>,
  ): Promise<T> {
    const run = await this.prisma.scanRun.create({
      data: { type, status: 'RUNNING' },
    });
    const ctx = new ScanRunContext(run.id);
    const startedAt = run.startedAt.getTime();

    try {
      const result = await executor(ctx);
      await this.finalize(run.id, 'COMPLETED', startedAt, ctx);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Scan run ${run.id} (${type}) failed: ${message}`);
      await this.finalize(run.id, 'FAILED', startedAt, ctx, message);
      throw error;
    }
  }

  private async finalize(
    id: string,
    status: 'COMPLETED' | 'FAILED',
    startedAt: number,
    ctx: ScanRunContext,
    error?: string,
  ): Promise<void> {
    const counts = ctx.getCounts();
    const stepTimings = ctx.getStepTimings();

    await this.prisma.scanRun.update({
      where: { id },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        stockCount: counts.stockCount ?? null,
        candidateCount: counts.candidateCount ?? null,
        focusListCount: counts.focusListCount ?? null,
        modelInputTokens: counts.modelInputTokens ?? null,
        modelOutputTokens: counts.modelOutputTokens ?? null,
        modelCostEstimate:
          counts.modelCostEstimate != null
            ? new Prisma.Decimal(counts.modelCostEstimate)
            : null,
        stepTimingsJson:
          Object.keys(stepTimings).length > 0
            ? (stepTimings as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        error: error ?? null,
        notes: ctx.getNote() ?? null,
      },
    });
  }

  /** Most recent scan runs, newest first. */
  list(limit = 50): Promise<ScanRun[]> {
    return this.prisma.scanRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  get(id: string): Promise<ScanRun | null> {
    return this.prisma.scanRun.findUnique({ where: { id } });
  }
}
