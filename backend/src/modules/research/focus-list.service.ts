import { Injectable, Logger } from '@nestjs/common';
import {
  FocusList,
  FocusListType,
  FocusReason,
  Prisma,
  SetupBias,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FocusListItemInput {
  stockId: string;
  reason: FocusReason;
  themeId?: string;
  groupId?: string;
  priorityScore?: number;
  setupBias?: SetupBias;
  expectedSetupTypes?: string[];
  keyLevels?: Prisma.InputJsonValue;
  invalidationLevels?: Prisma.InputJsonValue;
  identifiedSetup?: Prisma.InputJsonValue;
}

export interface CreateFocusListInput {
  name: string;
  type: FocusListType;
  expiresAt?: Date;
  sourceScanRunId?: string;
  notes?: string;
  items: FocusListItemInput[];
}

const MANUAL_LIST_NAME = 'Manual Pins';

/**
 * Manages focus lists: the bridge between twice-weekly full scans and
 * normal-day monitoring. Creation from a scan, retrieval of the current
 * active list, and manual pinning.
 */
@Injectable()
export class FocusListService {
  private readonly logger = new Logger(FocusListService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Create a focus list with its items. Duplicate stocks are de-duplicated. */
  async createList(input: CreateFocusListInput): Promise<FocusList> {
    const seen = new Set<string>();
    const items = input.items.filter((item) => {
      if (seen.has(item.stockId)) return false;
      seen.add(item.stockId);
      return true;
    });

    const list = await this.prisma.focusList.create({
      data: {
        name: input.name,
        type: input.type,
        expiresAt: input.expiresAt ?? null,
        sourceScanRunId: input.sourceScanRunId ?? null,
        notes: input.notes ?? null,
        items: {
          create: items.map((item) => this.toItemCreate(item)),
        },
      },
    });

    this.logger.log(
      `Created focus list "${list.name}" (${input.type}) with ${items.length} items`,
    );
    return list;
  }

  /** Most recent non-expired focus list with items + stock info, by priority. */
  async getCurrent() {
    const now = new Date();
    return this.prisma.focusList.findFirst({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          where: { status: { not: 'REMOVED' } },
          orderBy: [{ priorityScore: 'desc' }, { addedAt: 'asc' }],
          include: {
            stock: { select: { ticker: true, name: true } },
            theme: { select: { name: true } },
            group: { select: { name: true } },
          },
        },
      },
    });
  }

  listAll(limit = 50): Promise<FocusList[]> {
    return this.prisma.focusList.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Pin a stock onto the standing MANUAL focus list, creating that list on
   * first use. Re-pinning the same stock revives/updates the existing item.
   */
  async manualAdd(input: FocusListItemInput): Promise<void> {
    const list = await this.getOrCreateManualList();

    await this.prisma.focusListItem.upsert({
      where: {
        focusListId_stockId: {
          focusListId: list.id,
          stockId: input.stockId,
        },
      },
      create: {
        focusList: { connect: { id: list.id } },
        ...this.toItemCreate({ ...input, reason: FocusReason.MANUAL_PIN }),
      },
      update: {
        status: 'ACTIVE',
        setupBias: input.setupBias ?? undefined,
        priorityScore: input.priorityScore ?? undefined,
      },
    });
  }

  private async getOrCreateManualList(): Promise<FocusList> {
    const now = new Date();
    const existing = await this.prisma.focusList.findFirst({
      where: {
        type: 'MANUAL',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    return this.prisma.focusList.create({
      data: { name: MANUAL_LIST_NAME, type: 'MANUAL' },
    });
  }

  private toItemCreate(
    item: FocusListItemInput,
  ): Prisma.FocusListItemCreateWithoutFocusListInput {
    return {
      stock: { connect: { id: item.stockId } },
      theme: item.themeId ? { connect: { id: item.themeId } } : undefined,
      group: item.groupId ? { connect: { id: item.groupId } } : undefined,
      reason: item.reason,
      priorityScore: item.priorityScore ?? null,
      setupBias: item.setupBias ?? SetupBias.WATCH,
      expectedSetupTypesJson: item.expectedSetupTypes ?? Prisma.JsonNull,
      keyLevelsJson: item.keyLevels ?? Prisma.JsonNull,
      invalidationLevelsJson: item.invalidationLevels ?? Prisma.JsonNull,
      identifiedSetupJson: item.identifiedSetup ?? Prisma.JsonNull,
    };
  }
}
