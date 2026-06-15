import { Injectable, Logger } from '@nestjs/common';
import {
  Direction,
  FocusList,
  FocusReason,
  Prisma,
  SetupBias,
  SetupState,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalystService } from './catalyst.service';
import { FocusListService } from './focus-list.service';
import { MarketConditionService } from './market-condition.service';
import {
  TradableUniverseCandidate,
  UniverseFilterService,
} from './universe-filter.service';

interface ActiveSetupRow {
  stockId: string;
  type: string;
  state: SetupState;
  direction: Direction;
  pivotPrice: Prisma.Decimal | null;
  stopPrice: Prisma.Decimal | null;
  targetPrice: Prisma.Decimal | null;
  evidence: Prisma.JsonValue;
  waitingFor: string | null;
  detectedAt: Date;
}

export interface BuildFocusListOptions {
  sourceScanRunId?: string;
  maxItems?: number;
  includeStage4?: boolean;
  pinnedTickers?: string[];
}

export interface StrategyReport {
  date: string;
  marketCondition: unknown;
  focusListId: string | null;
  focusListSize: number;
  topCandidates: Array<{
    ticker: string;
    reason: FocusReason;
    bias: SetupBias;
    priorityScore: number;
    setupTypes: string[];
  }>;
  catalysts: unknown[];
  summary: string;
}

/**
 * Composes the twice-weekly research output: derives a focus list from the
 * tradable universe + active daily setups, then assembles a report that joins
 * market condition, the focus list, and active catalysts.
 */
@Injectable()
export class StrategyReportService {
  private readonly logger = new Logger(StrategyReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly universeFilter: UniverseFilterService,
    private readonly focusListService: FocusListService,
    private readonly marketCondition: MarketConditionService,
    private readonly catalystService: CatalystService,
  ) {}

  /**
   * Build a WEEKLY focus list from the current universe, prioritising names
   * with active daily setups and leadership. Returns the created list.
   */
  async buildWeeklyFocusList(
    options: BuildFocusListOptions = {},
  ): Promise<FocusList> {
    const maxItems = options.maxItems ?? 40;
    const universe = await this.universeFilter.getTradableUniverse({
      includeStage4: options.includeStage4,
      pinnedTickers: options.pinnedTickers,
    });

    const setupsByStock = await this.loadActiveSetups(
      universe.map((c) => c.stockId),
    );

    const items = universe
      .map((candidate) => this.toItem(candidate, setupsByStock.get(candidate.stockId) ?? []))
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
      .slice(0, maxItems);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.focusListService.createList({
      name: `Weekly Focus ${new Date().toISOString().slice(0, 10)}`,
      type: 'WEEKLY',
      expiresAt,
      sourceScanRunId: options.sourceScanRunId,
      items,
    });
  }

  /** Assemble the full research report from the latest state. */
  async generateReport(): Promise<StrategyReport> {
    const [focusList, indexCondition, universeCondition, catalysts] =
      await Promise.all([
        this.focusListService.getCurrent(),
        this.marketCondition.getLatest('INDEX', 'QQQ'),
        this.marketCondition.getLatest('TRADABLE_UNIVERSE', 'ALL'),
        this.catalystService.list('WATCHING', 10),
      ]);

    const items =
      (focusList?.items as Array<{
        reason: FocusReason;
        setupBias: SetupBias;
        priorityScore: Prisma.Decimal | null;
        expectedSetupTypesJson: Prisma.JsonValue;
        stock: { ticker: string };
      }>) ?? [];

    const topCandidates = items.slice(0, 15).map((item) => ({
      ticker: item.stock.ticker,
      reason: item.reason,
      bias: item.setupBias,
      priorityScore: item.priorityScore != null ? Number(item.priorityScore) : 0,
      setupTypes: Array.isArray(item.expectedSetupTypesJson)
        ? (item.expectedSetupTypesJson as string[])
        : [],
    }));

    return {
      date: new Date().toISOString().slice(0, 10),
      marketCondition: { index: indexCondition, universe: universeCondition },
      focusListId: focusList?.id ?? null,
      focusListSize: items.length,
      topCandidates,
      catalysts,
      summary: this.buildSummary(
        universeCondition?.summary ?? indexCondition?.summary ?? null,
        items.length,
        catalysts.length,
      ),
    };
  }

  private buildSummary(
    conditionSummary: string | null,
    focusSize: number,
    catalystCount: number,
  ): string {
    const parts: string[] = [];
    parts.push(conditionSummary ?? 'Market condition not yet computed');
    parts.push(`${focusSize} focus names`);
    parts.push(`${catalystCount} active catalysts`);
    return parts.join(' | ');
  }

  private async loadActiveSetups(
    stockIds: string[],
  ): Promise<Map<string, ActiveSetupRow[]>> {
    const map = new Map<string, ActiveSetupRow[]>();
    if (stockIds.length === 0) return map;

    const setups = await this.prisma.setup.findMany({
      where: {
        stockId: { in: stockIds },
        timeframe: 'DAILY',
        state: { in: ['BUILDING', 'READY', 'TRIGGERED'] },
      },
      select: {
        stockId: true,
        type: true,
        state: true,
        direction: true,
        pivotPrice: true,
        stopPrice: true,
        targetPrice: true,
        evidence: true,
        waitingFor: true,
        detectedAt: true,
      },
      orderBy: [{ state: 'desc' }, { detectedAt: 'desc' }],
    });

    for (const setup of setups) {
      const list = map.get(setup.stockId) ?? [];
      list.push(setup as ActiveSetupRow);
      map.set(setup.stockId, list);
    }
    return map;
  }

  private toItem(
    candidate: TradableUniverseCandidate,
    setups: ActiveSetupRow[],
  ) {
    const reason = this.deriveReason(candidate, setups);
    // Keep the focus list meaningful: only pure-liquidity names without any
    // setup or leadership reason are dropped.
    if (reason === null) return null;

    const bias = this.deriveBias(setups);
    const setupTypes = [...new Set(setups.map((s) => s.type))];
    const priorityScore = this.derivePriority(candidate, setups);
    const identifiedSetup = this.identifyPrimarySetup(setups);

    return {
      stockId: candidate.stockId,
      reason,
      priorityScore,
      setupBias: bias,
      expectedSetupTypes: setupTypes,
      keyLevels: this.buildKeyLevels(setups),
      identifiedSetup,
    };
  }

  private deriveReason(
    candidate: TradableUniverseCandidate,
    setups: ActiveSetupRow[],
  ): FocusReason | null {
    if (setups.length > 0) return FocusReason.STRONG_DAILY_SETUP;
    if (candidate.isCurrentLeader) return FocusReason.CURRENT_LEADER;
    if (candidate.isPreviousLeader) return FocusReason.PREVIOUS_LEADER_KEY_LEVEL;
    return null;
  }

  private deriveBias(setups: ActiveSetupRow[]): SetupBias {
    if (setups.length === 0) return SetupBias.WATCH;
    const hasLong = setups.some((s) => s.direction === 'LONG');
    const hasShort = setups.some((s) => s.direction === 'SHORT');
    if (hasLong && hasShort) return SetupBias.BOTH;
    if (hasShort) return SetupBias.SHORT;
    return SetupBias.LONG;
  }

  private derivePriority(
    candidate: TradableUniverseCandidate,
    setups: ActiveSetupRow[],
  ): number {
    let score = 50 + setups.length * 10;
    if (candidate.isCurrentLeader) score += 20;
    if (candidate.isPreviousLeader) score += 5;
    return Math.min(100, score);
  }

  private buildKeyLevels(setups: ActiveSetupRow[]): Prisma.InputJsonValue {
    const pivots: number[] = [];
    const stops: number[] = [];
    const targets: number[] = [];
    for (const s of setups) {
      if (s.pivotPrice != null) pivots.push(Number(s.pivotPrice));
      if (s.stopPrice != null) stops.push(Number(s.stopPrice));
      if (s.targetPrice != null) targets.push(Number(s.targetPrice));
    }
    return { pivots, stops, targets };
  }

  private identifyPrimarySetup(setups: ActiveSetupRow[]): Prisma.InputJsonValue {
    if (setups.length === 0) {
      return {
        type: null,
        state: 'NO_ACTIVE_SETUP',
        direction: 'WATCH',
        pivot: null,
        stop: null,
        target: null,
        evidence: [],
        rationale: 'No active daily setup; retained because of leadership or key-level context.',
      };
    }

    const primary = [...setups].sort((a, b) => {
      const stateScore = this.setupStateRank(b.state) - this.setupStateRank(a.state);
      if (stateScore !== 0) return stateScore;
      return b.detectedAt.getTime() - a.detectedAt.getTime();
    })[0];
    const evidence = Array.isArray(primary.evidence)
      ? primary.evidence.filter((item): item is string => typeof item === 'string').slice(0, 4)
      : [];

    return {
      type: primary.type,
      state: primary.state,
      direction: primary.direction,
      pivot: primary.pivotPrice != null ? Number(primary.pivotPrice) : null,
      stop: primary.stopPrice != null ? Number(primary.stopPrice) : null,
      target: primary.targetPrice != null ? Number(primary.targetPrice) : null,
      evidence,
      rationale:
        primary.waitingFor ??
        `${primary.type.replace(/_/g, ' ')} ${primary.direction.toLowerCase()} setup is ${primary.state.toLowerCase()}.`,
    };
  }

  private setupStateRank(state: SetupState): number {
    switch (state) {
      case SetupState.TRIGGERED:
        return 3;
      case SetupState.READY:
        return 2;
      case SetupState.BUILDING:
        return 1;
      default:
        return 0;
    }
  }
}
