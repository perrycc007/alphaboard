import { Injectable } from '@nestjs/common';
import {
  CatalystImpactDirection,
  CatalystImpactTimeframe,
  CatalystKind,
  CatalystStatus,
  MacroSensitivity,
  Prisma,
  RelationshipType,
  SupplyChainLayer,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RelationshipGraphFilters {
  catalystId?: string;
  kind?: CatalystKind;
  theme?: string;
  group?: string;
  layer?: SupplyChainLayer;
  eventCategory?: string;
  relationshipType?: RelationshipType;
  q?: string;
}

export interface RelationshipEvidence {
  sourceKeys: string[];
  sources: Array<{ key?: string; title?: string; url?: string }>;
  raw: unknown;
}

export interface RelationshipGraphResponse {
  selectedCatalystId: string | null;
  themes: Array<{ id: string; name: string; description: string | null }>;
  groups: Array<{
    id: string;
    themeId: string;
    themeName: string;
    name: string;
    layer: SupplyChainLayer | null;
    evidence: RelationshipEvidence;
  }>;
  stocks: Array<{
    id: string;
    ticker: string;
    name: string;
    sector: string | null;
    industry: string | null;
    groupIds: string[];
    role: string | null;
    evidence: RelationshipEvidence;
  }>;
  edges: Array<{
    id: string;
    sourceGroupId: string;
    targetGroupId: string;
    relationshipType: RelationshipType;
    macroSensitivity: MacroSensitivity | null;
    eventCategory: string | null;
    strengthScore: string | null;
    lagDaysEstimate: number | null;
    notes: string | null;
    evidence: RelationshipEvidence;
  }>;
  catalysts: Array<{
    id: string;
    title: string;
    themeId: string | null;
    groupId: string | null;
    kind: CatalystKind;
    eventCategory: string | null;
    observedStartDate: string | null;
    observedEndDate: string | null;
    status: CatalystStatus;
    confidenceScore: string | null;
    beneficiaries: unknown;
    losers: unknown;
    evidence: RelationshipEvidence;
  }>;
  mechanisms: Array<{
    id: string;
    catalystId: string;
    title: string;
    description: string | null;
    sortOrder: number;
    evidence: RelationshipEvidence;
  }>;
  impacts: Array<{
    id: string;
    catalystId: string;
    mechanismId: string;
    groupId: string;
    direction: CatalystImpactDirection;
    relationshipType: RelationshipType | null;
    strengthScore: string | null;
    timeframe: CatalystImpactTimeframe | null;
    notes: string | null;
    evidence: RelationshipEvidence;
    tickerExamples: Array<{
      id: string;
      ticker: string;
      name: string;
      role: string | null;
    }>;
  }>;
}

type GroupRow = Awaited<ReturnType<RelationshipGraphService['loadGroups']>>[number];
type EdgeRow = Awaited<ReturnType<RelationshipGraphService['loadEdges']>>[number];
type CatalystRow = Awaited<ReturnType<RelationshipGraphService['loadCatalysts']>>[number];
type MechanismRow = CatalystRow['mechanisms'][number];
type ImpactRow = MechanismRow['impacts'][number];

@Injectable()
export class RelationshipGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getGraph(
    filters: RelationshipGraphFilters = {},
  ): Promise<RelationshipGraphResponse> {
    const normalized = normalizeFilters(filters);
    const [groups, edges, catalysts] = await Promise.all([
      this.loadGroups(),
      this.loadEdges(),
      this.loadCatalysts(),
    ]);

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const eligibleCatalysts = catalysts.filter((catalyst) =>
      this.matchesCatalystListFilters(catalyst, groupById, normalized),
    );
    const selectedCatalyst = this.selectCatalyst(eligibleCatalysts, normalized);
    const selectedImpacts = selectedCatalyst
      ? this.selectImpacts(selectedCatalyst, groupById, normalized)
      : [];
    const selectedMechanismIds = new Set(
      selectedImpacts.map((impact) => impact.mechanismId),
    );
    const selectedGroupIds = new Set(selectedImpacts.map((impact) => impact.groupId));

    if (selectedCatalyst?.groupId && !hasImpactScopedFilter(normalized)) {
      selectedGroupIds.add(selectedCatalyst.groupId);
    }

    const selectedGroups = groups.filter((group) => selectedGroupIds.has(group.id));
    const selectedEdges = edges.filter(
      (edge) =>
        selectedGroupIds.has(edge.sourceGroupId) &&
        selectedGroupIds.has(edge.targetGroupId) &&
        this.matchesRelationshipFilters(edge, groupById, normalized),
    );

    return {
      selectedCatalystId: selectedCatalyst?.id ?? null,
      themes: this.toThemes(selectedGroups),
      groups: selectedGroups.map((group) => this.toGroupDto(group)),
      stocks: this.toStockDtos(selectedGroups),
      edges: selectedEdges.map((edge) => this.toEdgeDto(edge)),
      catalysts: eligibleCatalysts.map((catalyst) => this.toCatalystDto(catalyst)),
      mechanisms: selectedCatalyst
        ? selectedCatalyst.mechanisms
            .filter((mechanism) => selectedMechanismIds.has(mechanism.id))
            .map((mechanism) => this.toMechanismDto(mechanism))
        : [],
      impacts: selectedImpacts.map((impact) =>
        this.toImpactDto(impact, selectedCatalyst!.id, groupById),
      ),
    };
  }

  private loadGroups() {
    return this.prisma.supplyChainGroup.findMany({
      include: {
        theme: { select: { id: true, name: true, description: true } },
        themeStocks: {
          include: {
            stock: {
              select: {
                id: true,
                ticker: true,
                name: true,
                sector: true,
                industry: true,
                metadataEvidenceJson: true,
                themeMemberships: {
                  select: {
                    themeId: true,
                    groupId: true,
                    roleDescription: true,
                    importanceScore: true,
                    evidenceJson: true,
                  },
                },
              },
            },
          },
          orderBy: { stock: { ticker: 'asc' } },
        },
      },
      orderBy: [
        { theme: { name: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  private loadEdges() {
    return this.prisma.groupRelationship.findMany({
      include: {
        sourceGroup: { include: { theme: { select: { id: true, name: true } } } },
        targetGroup: { include: { theme: { select: { id: true, name: true } } } },
      },
      orderBy: [{ sourceGroup: { theme: { name: 'asc' } } }, { createdAt: 'asc' }],
    });
  }

  private loadCatalysts() {
    return this.prisma.catalystHypothesis.findMany({
      where: { status: { in: ['WATCHING', 'CONFIRMED'] } },
      include: {
        theme: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, themeId: true, layer: true } },
        mechanisms: {
          include: {
            impacts: {
              include: {
                group: {
                  include: {
                    theme: { select: { id: true, name: true, description: true } },
                  },
                },
              },
              orderBy: [{ direction: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  private selectCatalyst(
    catalysts: CatalystRow[],
    filters: RelationshipGraphFilters,
  ): CatalystRow | null {
    if (filters.catalystId) {
      return catalysts.find((catalyst) => catalyst.id === filters.catalystId) ?? null;
    }

    const withImpacts = catalysts.filter((catalyst) =>
      catalyst.mechanisms.some((mechanism) => mechanism.impacts.length > 0),
    );
    const kinds = filters.kind
      ? [filters.kind]
      : (['CURRENT', 'HISTORICAL', 'PATTERN'] as CatalystKind[]);

    for (const kind of kinds) {
      const catalyst = withImpacts.find((item) => item.kind === kind);
      if (catalyst) return catalyst;
    }
    return catalysts[0] ?? null;
  }

  private selectImpacts(
    catalyst: CatalystRow,
    groupById: Map<string, GroupRow>,
    filters: RelationshipGraphFilters,
  ): ImpactRow[] {
    return catalyst.mechanisms.flatMap((mechanism) =>
      mechanism.impacts.filter((impact) =>
        this.matchesImpactFilters(catalyst, mechanism, impact, groupById, filters),
      ),
    );
  }

  private matchesCatalystListFilters(
    catalyst: CatalystRow,
    groupById: Map<string, GroupRow>,
    filters: RelationshipGraphFilters,
  ): boolean {
    if (filters.kind && catalyst.kind !== filters.kind) return false;
    if (filters.eventCategory && !matches(filters.eventCategory, catalyst.eventCategory)) {
      return false;
    }
    if (filters.catalystId && catalyst.id !== filters.catalystId) return false;

    const impacts = catalyst.mechanisms.flatMap((mechanism) => mechanism.impacts);
    if (
      (filters.theme || filters.group || filters.layer || filters.relationshipType) &&
      !impacts.some((impact) =>
        this.matchesImpactFilters(catalyst, null, impact, groupById, filters),
      )
    ) {
      return false;
    }

    if (
      filters.q &&
      !matchesAny(filters.q, [
        catalyst.title,
        catalyst.hypothesis,
        catalyst.kind,
        catalyst.eventCategory,
        catalyst.theme?.name,
        catalyst.group?.name,
        JSON.stringify(catalyst.expectedBeneficiariesJson ?? {}),
        JSON.stringify(catalyst.expectedLosersJson ?? {}),
        JSON.stringify(catalyst.evidenceJson ?? {}),
      ]) &&
      !catalyst.mechanisms.some((mechanism) =>
        matchesAny(filters.q!, [
          mechanism.title,
          mechanism.description,
          JSON.stringify(mechanism.evidenceJson ?? {}),
        ]) ||
        mechanism.impacts.some((impact) =>
          this.impactMatchesSearch(impact, groupById, filters.q!),
        ),
      )
    ) {
      return false;
    }

    return true;
  }

  private matchesImpactFilters(
    catalyst: CatalystRow,
    mechanism: MechanismRow | null,
    impact: ImpactRow,
    groupById: Map<string, GroupRow>,
    filters: RelationshipGraphFilters,
  ): boolean {
    const group = groupById.get(impact.groupId);
    if (!group) return false;
    if (
      filters.theme &&
      !matchesAny(filters.theme, [group.themeId, group.theme.name])
    ) {
      return false;
    }
    if (filters.group && !matchesAny(filters.group, [group.id, group.name])) {
      return false;
    }
    if (filters.layer && group.layer !== filters.layer) return false;
    if (filters.relationshipType && impact.relationshipType !== filters.relationshipType) {
      return false;
    }
    if (filters.eventCategory && !matches(filters.eventCategory, catalyst.eventCategory)) {
      return false;
    }
    if (
      filters.q &&
      !matchesAny(filters.q, [
        catalyst.title,
        catalyst.hypothesis,
        catalyst.kind,
        catalyst.eventCategory,
        mechanism?.title,
        mechanism?.description,
      ]) &&
      !this.impactMatchesSearch(impact, groupById, filters.q)
    ) {
      return false;
    }
    return true;
  }

  private impactMatchesSearch(
    impact: ImpactRow,
    groupById: Map<string, GroupRow>,
    q: string,
  ): boolean {
    const group = groupById.get(impact.groupId);
    if (!group) return false;
    return matchesAny(q, [
      group.name,
      group.theme.name,
      group.layer,
      impact.direction,
      impact.relationshipType,
      impact.timeframe,
      impact.notes,
      JSON.stringify(impact.evidenceJson ?? {}),
      ...group.themeStocks.flatMap(({ stock }) => [
        stock.ticker,
        stock.name,
        stock.sector,
        stock.industry,
        ...stock.themeMemberships.flatMap((membership) => [
          membership.roleDescription,
          JSON.stringify(membership.evidenceJson ?? {}),
        ]),
      ]),
    ]);
  }

  private matchesRelationshipFilters(
    edge: EdgeRow,
    groupById: Map<string, GroupRow>,
    filters: RelationshipGraphFilters,
  ): boolean {
    const sourceGroup = groupById.get(edge.sourceGroupId) ?? edge.sourceGroup;
    const targetGroup = groupById.get(edge.targetGroupId) ?? edge.targetGroup;
    if (
      filters.theme &&
      !matchesAny(filters.theme, [
        sourceGroup.themeId,
        sourceGroup.theme.name,
        targetGroup.themeId,
        targetGroup.theme.name,
      ])
    ) {
      return false;
    }
    if (
      filters.group &&
      !matchesAny(filters.group, [
        sourceGroup.id,
        sourceGroup.name,
        targetGroup.id,
        targetGroup.name,
      ])
    ) {
      return false;
    }
    if (
      filters.layer &&
      sourceGroup.layer !== filters.layer &&
      targetGroup.layer !== filters.layer
    ) {
      return false;
    }
    if (filters.relationshipType && edge.relationshipType !== filters.relationshipType) {
      return false;
    }
    return true;
  }

  private toThemes(groups: GroupRow[]): RelationshipGraphResponse['themes'] {
    const byId = new Map<string, RelationshipGraphResponse['themes'][number]>();
    for (const group of groups) {
      byId.set(group.theme.id, {
        id: group.theme.id,
        name: group.theme.name,
        description: group.theme.description,
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private toGroupDto(group: GroupRow): RelationshipGraphResponse['groups'][number] {
    return {
      id: group.id,
      themeId: group.themeId,
      themeName: group.theme.name,
      name: group.name,
      layer: group.layer,
      evidence: normalizeEvidence(group.evidenceJson),
    };
  }

  private toStockDtos(groups: GroupRow[]): RelationshipGraphResponse['stocks'] {
    const byStock = new Map<string, RelationshipGraphResponse['stocks'][number]>();
    for (const group of groups) {
      for (const { stock } of group.themeStocks) {
        const membership = preferredMembership(stock.themeMemberships, group);
        const existing = byStock.get(stock.id);
        if (existing) {
          if (!existing.groupIds.includes(group.id)) existing.groupIds.push(group.id);
          continue;
        }
        byStock.set(stock.id, {
          id: stock.id,
          ticker: stock.ticker,
          name: stock.name,
          sector: stock.sector,
          industry: stock.industry,
          groupIds: [group.id],
          role: membership?.roleDescription ?? null,
          evidence: normalizeEvidence(
            membership?.evidenceJson ?? stock.metadataEvidenceJson,
          ),
        });
      }
    }
    return [...byStock.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  private toEdgeDto(edge: EdgeRow): RelationshipGraphResponse['edges'][number] {
    return {
      id: edge.id,
      sourceGroupId: edge.sourceGroupId,
      targetGroupId: edge.targetGroupId,
      relationshipType: edge.relationshipType,
      macroSensitivity: edge.macroSensitivity,
      eventCategory: edge.eventCategory,
      strengthScore: edge.strengthScore?.toString() ?? null,
      lagDaysEstimate: edge.lagDaysEstimate,
      notes: edge.notes,
      evidence: normalizeEvidence(edge.evidenceJson),
    };
  }

  private toCatalystDto(
    catalyst: CatalystRow,
  ): RelationshipGraphResponse['catalysts'][number] {
    return {
      id: catalyst.id,
      title: catalyst.title,
      themeId: catalyst.themeId,
      groupId: catalyst.groupId,
      kind: catalyst.kind,
      eventCategory: catalyst.eventCategory,
      observedStartDate: dateOnly(catalyst.observedStartDate),
      observedEndDate: dateOnly(catalyst.observedEndDate),
      status: catalyst.status,
      confidenceScore: catalyst.confidenceScore?.toString() ?? null,
      beneficiaries: catalyst.expectedBeneficiariesJson,
      losers: catalyst.expectedLosersJson,
      evidence: normalizeEvidence(catalyst.evidenceJson ?? catalyst.sourceUrlsJson),
    };
  }

  private toMechanismDto(
    mechanism: MechanismRow,
  ): RelationshipGraphResponse['mechanisms'][number] {
    return {
      id: mechanism.id,
      catalystId: mechanism.catalystId,
      title: mechanism.title,
      description: mechanism.description,
      sortOrder: mechanism.sortOrder,
      evidence: normalizeEvidence(mechanism.evidenceJson),
    };
  }

  private toImpactDto(
    impact: ImpactRow,
    catalystId: string,
    groupById: Map<string, GroupRow>,
  ): RelationshipGraphResponse['impacts'][number] {
    return {
      id: impact.id,
      catalystId,
      mechanismId: impact.mechanismId,
      groupId: impact.groupId,
      direction: impact.direction,
      relationshipType: impact.relationshipType,
      strengthScore: impact.strengthScore?.toString() ?? null,
      timeframe: impact.timeframe,
      notes: impact.notes,
      evidence: normalizeEvidence(impact.evidenceJson),
      tickerExamples: this.tickerExamplesForGroup(groupById.get(impact.groupId)),
    };
  }

  private tickerExamplesForGroup(
    group: GroupRow | undefined,
  ): RelationshipGraphResponse['impacts'][number]['tickerExamples'] {
    if (!group) return [];
    return [...group.themeStocks]
      .map(({ stock }) => {
        const membership = preferredMembership(stock.themeMemberships, group);
        return {
          id: stock.id,
          ticker: stock.ticker,
          name: stock.name,
          role: membership?.roleDescription ?? null,
          importance: membership?.importanceScore?.toNumber() ?? 0,
        };
      })
      .sort((a, b) => b.importance - a.importance || a.ticker.localeCompare(b.ticker))
      .slice(0, 8)
      .map(({ importance: _importance, ...stock }) => stock);
  }
}

function normalizeFilters(
  filters: RelationshipGraphFilters,
): RelationshipGraphFilters {
  return {
    catalystId: trim(filters.catalystId),
    kind: filters.kind,
    theme: trim(filters.theme),
    group: trim(filters.group),
    layer: filters.layer,
    eventCategory: trim(filters.eventCategory),
    relationshipType: filters.relationshipType,
    q: trim(filters.q),
  };
}

function hasImpactScopedFilter(filters: RelationshipGraphFilters): boolean {
  return Boolean(
    filters.theme ||
      filters.group ||
      filters.layer ||
      filters.relationshipType ||
      filters.q,
  );
}

function preferredMembership<
  T extends {
    themeId: string;
    groupId: string | null;
    roleDescription: string | null;
    importanceScore?: Prisma.Decimal | null;
    evidenceJson?: Prisma.JsonValue | null;
  },
>(
  memberships: T[],
  group: { id: string; themeId: string },
): T | null {
  return (
    memberships.find((item) => item.groupId === group.id) ??
    memberships.find((item) => item.themeId === group.themeId) ??
    null
  );
}

function trim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function matchesAny(needle: string, values: Array<unknown>): boolean {
  return values.some((value) => matches(needle, value));
}

function matches(needle: string, value: unknown): boolean {
  if (value == null) return false;
  return String(value).toLowerCase().includes(needle.toLowerCase());
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function normalizeEvidence(value: Prisma.JsonValue): RelationshipEvidence {
  if (Array.isArray(value)) {
    const sources = value
      .filter((item): item is string => typeof item === 'string')
      .map((url) => ({ url }));
    return { sourceKeys: [], sources, raw: value };
  }
  if (!value || typeof value !== 'object') {
    return { sourceKeys: [], sources: [], raw: value ?? null };
  }

  const record = value as Record<string, unknown>;
  const sourceKeys = Array.isArray(record.sourceKeys)
    ? record.sourceKeys.filter((item): item is string => typeof item === 'string')
    : [];
  const sources = Array.isArray(record.sources)
    ? record.sources
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const source = item as Record<string, unknown>;
          return {
            key: typeof source.key === 'string' ? source.key : undefined,
            title: typeof source.title === 'string' ? source.title : undefined,
            url: typeof source.url === 'string' ? source.url : undefined,
          };
        })
        .filter((source) => source.key || source.title || source.url)
    : [];

  return { sourceKeys, sources, raw: value };
}
