import { Injectable } from '@nestjs/common';
import {
  FocusReason,
  Prisma,
  ScanRunStatus,
  SetupBias,
  SetupScanAuditStatus,
  SetupScanFocusStatus,
  StageEnum,
  StockCategory,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SetupAuditInputSnapshot {
  stockId: string;
  ticker: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  stage?: StageEnum | null;
  category?: StockCategory | null;
  latestClose?: number | null;
  avgVolume?: bigint | number | null;
  eligibleByScanFilter: boolean;
  minPrice: number;
  minAvgVolume: number;
}

export interface ClassifiedSetupAuditInput {
  scanStatus: SetupScanAuditStatus;
  reasonCodes: string[];
  reasonText: string;
  isCandidate: boolean;
}

export interface SetupAuditDetectedSetup {
  setupId?: string;
  type: string;
  direction: string;
  timeframe: string;
  state?: string;
  pivotPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  riskReward?: number | null;
  evidence?: string[];
  waitingFor?: string | null;
  detectedAt?: string;
  detectorSource?: string;
  outcome?: 'created' | 'deduped' | 'suppressed';
  reason?: string;
}

export interface SetupAuditScanResult {
  detectorSource: string;
  created: SetupAuditDetectedSetup[];
  deduped: SetupAuditDetectedSetup[];
  suppressed: SetupAuditDetectedSetup[];
}

export interface SetupAuditItemFilters {
  page?: number;
  limit?: number;
  scanStatus?: SetupScanAuditStatus;
  focusStatus?: SetupScanFocusStatus;
  setupType?: string;
  ticker?: string;
  q?: string;
}

const REASON_LABELS: Record<string, string> = {
  PASSED_PREFILTER: 'Passed setup scan prefilter',
  LOW_VOLUME: 'Average volume is below scan minimum',
  LOW_PRICE: 'Latest close is below scan minimum',
  MISSING_PRICE: 'No latest daily close available',
  NO_QUALIFYING_CONTEXT: 'No qualifying stage, leader, sector, or industry context',
  CANDIDATE_PENDING_SCAN: 'Queued for setup detection',
  INSUFFICIENT_BARS: 'Fewer than 50 daily bars available',
  NO_DETECTOR_MATCH: 'No setup detector matched',
  SETUP_DETECTED: 'At least one setup was detected',
  SETUP_DEDUPED: 'Detected setup matched a recent duplicate',
  SETUP_SUPPRESSED: 'Detected setup was suppressed by scan rules',
  SCAN_ERROR: 'Setup scan failed for this ticker',
  FOCUS_INCLUDED: 'Included in the focus list',
  FOCUS_EXCLUDED: 'Not selected for the focus list',
};

export function classifySetupAuditInput(
  input: SetupAuditInputSnapshot,
): ClassifiedSetupAuditInput {
  const reasonCodes: string[] = [];
  const avgVolume =
    input.avgVolume == null ? null : Number(input.avgVolume);
  const pricePass = input.latestClose != null && input.latestClose >= input.minPrice;
  const volumePass = avgVolume != null && avgVolume >= input.minAvgVolume;

  if (!volumePass) reasonCodes.push('LOW_VOLUME');
  if (input.latestClose == null) {
    reasonCodes.push('MISSING_PRICE');
  } else if (!pricePass) {
    reasonCodes.push('LOW_PRICE');
  }
  if (!input.eligibleByScanFilter) {
    reasonCodes.push('NO_QUALIFYING_CONTEXT');
  }

  const isCandidate =
    input.eligibleByScanFilter && pricePass && volumePass;
  if (isCandidate) reasonCodes.push('PASSED_PREFILTER');

  return {
    scanStatus: isCandidate
      ? SetupScanAuditStatus.CANDIDATE
      : SetupScanAuditStatus.INPUT_FILTERED,
    reasonCodes,
    reasonText: formatReasonText(reasonCodes),
    isCandidate,
  };
}

export function setupAuditStatusFromDetection(
  result: SetupAuditScanResult,
): SetupScanAuditStatus {
  if (result.created.length > 0) return SetupScanAuditStatus.DETECTED;
  if (result.deduped.length > 0) return SetupScanAuditStatus.DEDUPED;
  if (result.suppressed.length > 0) return SetupScanAuditStatus.SUPPRESSED;
  return SetupScanAuditStatus.NO_SETUP;
}

function formatReasonText(reasonCodes: string[]): string {
  if (reasonCodes.length === 0) return 'No reason recorded';
  return reasonCodes.map((code) => REASON_LABELS[code] ?? code).join('; ');
}

@Injectable()
export class SetupAuditService {
  constructor(private readonly prisma: PrismaService) {}

  createRun(scanRunId?: string | null) {
    return this.prisma.setupScanAuditRun.create({
      data: { scanRunId: scanRunId ?? null },
    });
  }

  async seedItems(auditRunId: string, inputs: SetupAuditInputSnapshot[]) {
    if (inputs.length === 0) return { count: 0, candidateCount: 0 };

    const data = inputs.map((input) => {
      const classified = classifySetupAuditInput(input);
      return {
        auditRunId,
        stockId: input.stockId,
        ticker: input.ticker,
        name: input.name ?? null,
        sector: input.sector ?? null,
        industry: input.industry ?? null,
        stage: input.stage ?? null,
        category: input.category ?? null,
        latestClose:
          input.latestClose != null
            ? new Prisma.Decimal(input.latestClose)
            : null,
        avgVolume:
          input.avgVolume != null ? BigInt(input.avgVolume) : null,
        scanStatus: classified.scanStatus,
        reasonCodesJson: classified.reasonCodes,
        reasonText: classified.reasonText,
      };
    });

    const candidateCount = data.filter(
      (item) => item.scanStatus === SetupScanAuditStatus.CANDIDATE,
    ).length;

    await this.prisma.setupScanAuditItem.createMany({
      data,
      skipDuplicates: true,
    });

    await this.prisma.setupScanAuditRun.update({
      where: { id: auditRunId },
      data: {
        stockCount: inputs.length,
        inputCount: inputs.length,
        candidateCount,
      },
    });

    return { count: inputs.length, candidateCount };
  }

  markInsufficientData(auditRunId: string, stockId: string, barCount: number) {
    return this.updateItem(auditRunId, stockId, {
      scanStatus: SetupScanAuditStatus.INSUFFICIENT_DATA,
      reasonCodesJson: ['INSUFFICIENT_BARS'],
      reasonText: `${REASON_LABELS.INSUFFICIENT_BARS}: ${barCount}`,
      scannedAt: new Date(),
    });
  }

  markScanError(auditRunId: string, stockId: string, error: string) {
    return this.updateItem(auditRunId, stockId, {
      scanStatus: SetupScanAuditStatus.ERROR,
      reasonCodesJson: ['SCAN_ERROR'],
      reasonText: REASON_LABELS.SCAN_ERROR,
      error,
      scannedAt: new Date(),
    });
  }

  markDetectionResult(
    auditRunId: string,
    stockId: string,
    result: SetupAuditScanResult,
  ) {
    const status = setupAuditStatusFromDetection(result);
    const reasonCodes =
      status === SetupScanAuditStatus.DETECTED
        ? ['SETUP_DETECTED']
        : status === SetupScanAuditStatus.DEDUPED
          ? ['SETUP_DEDUPED']
          : status === SetupScanAuditStatus.SUPPRESSED
            ? ['SETUP_SUPPRESSED']
            : ['NO_DETECTOR_MATCH'];
    const detectedSetups = [
      ...result.created.map((setup) => ({ ...setup, outcome: 'created' as const })),
      ...result.deduped.map((setup) => ({ ...setup, outcome: 'deduped' as const })),
      ...result.suppressed.map((setup) => ({ ...setup, outcome: 'suppressed' as const })),
    ];
    const setupTypes = [...new Set(detectedSetups.map((setup) => setup.type))];

    return this.updateItem(auditRunId, stockId, {
      scanStatus: status,
      reasonCodesJson: reasonCodes,
      reasonText: formatReasonText(reasonCodes),
      setupTypesText: setupTypes.length > 0 ? setupTypes.join(',') : null,
      detectedSetupsJson:
        detectedSetups.length > 0
          ? (detectedSetups as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      scannedAt: new Date(),
    });
  }

  async markFocusListOutcomes(
    scanRunId: string | null | undefined,
    includedItems: Array<{
      stockId: string;
      reason: FocusReason;
      priorityScore?: number | null;
      setupBias?: SetupBias;
      identifiedSetup?: Prisma.InputJsonValue;
    }>,
  ): Promise<void> {
    if (!scanRunId) return;

    const auditRun = await this.prisma.setupScanAuditRun.findFirst({
      where: { scanRunId },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (!auditRun) return;

    const includedStockIds = includedItems.map((item) => item.stockId);
    if (includedStockIds.length > 0) {
      for (const item of includedItems) {
        await this.updateItem(auditRun.id, item.stockId, {
          focusStatus: SetupScanFocusStatus.INCLUDED,
          focusReason: item.reason,
          setupBias: item.setupBias ?? null,
          priorityScore:
            item.priorityScore != null
              ? new Prisma.Decimal(item.priorityScore)
              : null,
          identifiedSetupJson: item.identifiedSetup ?? Prisma.JsonNull,
        });
      }
    }

    await this.prisma.setupScanAuditItem.updateMany({
      where: {
        auditRunId: auditRun.id,
        focusStatus: SetupScanFocusStatus.NOT_EVALUATED,
        ...(includedStockIds.length > 0
          ? { stockId: { notIn: includedStockIds } }
          : {}),
      },
      data: {
        focusStatus: SetupScanFocusStatus.EXCLUDED,
      },
    });

    await this.refreshRunCounts(auditRun.id);
  }

  async completeRun(
    id: string,
    status: ScanRunStatus,
    startedAt: Date,
    error?: string,
  ) {
    await this.refreshRunCounts(id);
    await this.prisma.setupScanAuditRun.update({
      where: { id },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        error: error ?? null,
      },
    });
  }

  async refreshRunCounts(id: string): Promise<void> {
    const [inputCount, candidateCount, detectedCount, focusIncludedCount] =
      await Promise.all([
        this.prisma.setupScanAuditItem.count({ where: { auditRunId: id } }),
        this.prisma.setupScanAuditItem.count({
          where: {
            auditRunId: id,
            scanStatus: { not: SetupScanAuditStatus.INPUT_FILTERED },
          },
        }),
        this.prisma.setupScanAuditItem.count({
          where: { auditRunId: id, scanStatus: SetupScanAuditStatus.DETECTED },
        }),
        this.prisma.setupScanAuditItem.count({
          where: { auditRunId: id, focusStatus: SetupScanFocusStatus.INCLUDED },
        }),
      ]);

    await this.prisma.setupScanAuditRun.update({
      where: { id },
      data: {
        inputCount,
        stockCount: inputCount,
        candidateCount,
        detectedCount,
        focusIncludedCount,
      },
    });
  }

  listRuns(limit = 50) {
    return this.prisma.setupScanAuditRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async getSummary(runId: string) {
    const run = await this.prisma.setupScanAuditRun.findUniqueOrThrow({
      where: { id: runId },
    });
    const [byScanStatus, byFocusStatus] = await Promise.all([
      this.prisma.setupScanAuditItem.groupBy({
        by: ['scanStatus'],
        where: { auditRunId: runId },
        _count: { _all: true },
      }),
      this.prisma.setupScanAuditItem.groupBy({
        by: ['focusStatus'],
        where: { auditRunId: runId },
        _count: { _all: true },
      }),
    ]);

    return {
      run,
      scanStatusCounts: Object.fromEntries(
        byScanStatus.map((row) => [row.scanStatus, row._count._all]),
      ),
      focusStatusCounts: Object.fromEntries(
        byFocusStatus.map((row) => [row.focusStatus, row._count._all]),
      ),
    };
  }

  async listItems(runId: string, filters: SetupAuditItemFilters) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 24, 1), 60);
    const where = this.buildItemWhere(runId, filters);

    const [items, total] = await Promise.all([
      this.prisma.setupScanAuditItem.findMany({
        where,
        orderBy: [{ scanStatus: 'asc' }, { ticker: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          stock: {
            select: {
              dailyBars: {
                orderBy: { date: 'desc' },
                take: 160,
              },
            },
          },
        },
      }),
      this.prisma.setupScanAuditItem.count({ where }),
    ]);

    return {
      items: items.map((item) => {
        const { stock, ...rest } = item;
        return {
          ...rest,
          dailyBars: [...stock.dailyBars].reverse(),
        };
      }),
      total,
      page,
      limit,
    };
  }

  async getModelReviews(itemId: string) {
    const item = await this.prisma.setupScanAuditItem.findUniqueOrThrow({
      where: { id: itemId },
      select: {
        ticker: true,
        modelReviewIdsJson: true,
        auditRun: { select: { scanRunId: true } },
      },
    });
    const ids = Array.isArray(item.modelReviewIdsJson)
      ? item.modelReviewIdsJson.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    return this.prisma.modelReview.findMany({
      where: {
        OR: [
          ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
          {
            targetId: item.ticker,
            ...(item.auditRun.scanRunId
              ? { scanRunId: item.auditRun.scanRunId }
              : {}),
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  private updateItem(
    auditRunId: string,
    stockId: string,
    data: Prisma.SetupScanAuditItemUpdateInput,
  ) {
    return this.prisma.setupScanAuditItem.update({
      where: { auditRunId_stockId: { auditRunId, stockId } },
      data,
    });
  }

  private buildItemWhere(
    runId: string,
    filters: SetupAuditItemFilters,
  ): Prisma.SetupScanAuditItemWhereInput {
    const where: Prisma.SetupScanAuditItemWhereInput = { auditRunId: runId };
    if (filters.scanStatus) where.scanStatus = filters.scanStatus;
    if (filters.focusStatus) where.focusStatus = filters.focusStatus;
    if (filters.ticker) where.ticker = filters.ticker.toUpperCase();
    if (filters.q) {
      where.OR = [
        { ticker: { contains: filters.q, mode: 'insensitive' } },
        { name: { contains: filters.q, mode: 'insensitive' } },
        { reasonText: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    if (filters.setupType) {
      where.setupTypesText = { contains: filters.setupType };
    }
    return where;
  }
}
