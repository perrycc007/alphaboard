import { Injectable } from '@nestjs/common';
import {
  CatalystStatus,
  MacroSensitivity,
  Prisma,
  RelationshipType,
  SupplyChainLayer,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RelationshipGraphFilters {
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
    status: CatalystStatus;
    confidenceScore: string | null;
    beneficiaries: unknown;
    losers: unknown;
    evidence: RelationshipEvidence;
  }>;
}

type GroupRow = Awaited<ReturnType<RelationshipGraphService['loadGroups']>>[number];
type EdgeRow = Awaited<ReturnType<RelationshipGraphService['loadEdges']>>[number];
type CatalystRow = Awaited<ReturnType<RelationshipGraphService['loadCatalysts']>>[number];

@Injectable()
export class RelationshipGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getGraph(
    filters: RelationshipGraphFilters = {},
  ): Promise<RelationshipGraphResponse> {
    const [groups, edges, catalysts] = await Promise.all([
      this.loadGroups(),
      this.loadEdges(),
      this.loadCatalysts(),
    ]);

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const selectedGroupIds = this.selectGroupIds(groups, edges, catalysts, filters);
    const selectedGroups = groups.filter((group) => selectedGroupIds.has(group.id));
    const selectedThemes = this.toThemes(selectedGroups);
    const selectedEdges = edges.filter(
      (edge) =>
        selectedGroupIds.has(edge.sourceGroupId) &&
        selectedGroupIds.has(edge.targetGroupId) &&
        this.matchesRelationshipFilters(edge, groupById, filters),
    );
    const selectedCatalysts = catalysts.filter((catalyst) =>
      this.matchesCatalystFilters(catalyst, groupById, selectedGroupIds, filters),
    );

    return {
      themes: selectedThemes,
      groups: selectedGroups.map((group) => this.toGroupDto(group)),
      stocks: this.toStockDtos(selectedGroups),
      edges: selectedEdges.map((edge) => this.toEdgeDto(edge)),
      catalysts: selectedCatalysts.map((catalyst) => this.toCatalystDto(catalyst)),
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
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private selectGroupIds(
    groups: GroupRow[],
    edges: EdgeRow[],
    catalysts: CatalystRow[],
    filters: RelationshipGraphFilters,
  ): Set<string> {
    const normalized = normalizeFilters(filters);
    const selected = new Set<string>();
    const hasFilter =
      Boolean(normalized.theme) ||
      Boolean(normalized.group) ||
      Boolean(normalized.layer) ||
      Boolean(normalized.eventCategory) ||
      Boolean(normalized.relationshipType) ||
      Boolean(normalized.q);

    if (!hasFilter) return new Set(groups.map((group) => group.id));

    for (const group of groups) {
      if (this.matchesGroupFilters(group, normalized)) selected.add(group.id);
      if (normalized.q && this.groupHasMatchingStock(group, normalized.q)) {
        selected.add(group.id);
      }
    }

    for (const edge of edges) {
      if (this.matchesRelationshipFilters(edge, undefined, normalized)) {
        selected.add(edge.sourceGroupId);
        selected.add(edge.targetGroupId);
      }
    }

    for (const catalyst of catalysts) {
      if (this.matchesCatalystFilters(catalyst, undefined, undefined, normalized)) {
        if (catalyst.groupId) selected.add(catalyst.groupId);
        if (catalyst.themeId) {
          groups
            .filter((group) => group.themeId === catalyst.themeId)
            .forEach((group) => selected.add(group.id));
        }
      }
    }

    return selected;
  }

  private matchesGroupFilters(
    group: GroupRow,
    filters: RelationshipGraphFilters,
  ): boolean {
    if (filters.theme && !matchesAny(filters.theme, [group.themeId, group.theme.name])) {
      return false;
    }
    if (filters.group && !matchesAny(filters.group, [group.id, group.name])) {
      return false;
    }
    if (filters.layer && group.layer !== filters.layer) {
      return false;
    }
    if (
      filters.q &&
      !matchesAny(filters.q, [
        group.name,
        group.theme.name,
        group.layer,
        JSON.stringify(group.evidenceJson ?? {}),
      ])
    ) {
      return false;
    }
    return true;
  }

  private groupHasMatchingStock(group: GroupRow, q: string): boolean {
    return group.themeStocks.some(({ stock }) =>
      matchesAny(q, [stock.ticker, stock.name, stock.sector, stock.industry]),
    );
  }

  private matchesRelationshipFilters(
    edge: EdgeRow,
    groupById: Map<string, GroupRow> | undefined,
    filters: RelationshipGraphFilters,
  ): boolean {
    const sourceGroup = groupById?.get(edge.sourceGroupId) ?? edge.sourceGroup;
    const targetGroup = groupById?.get(edge.targetGroupId) ?? edge.targetGroup;
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
    if (filters.eventCategory && !matches(filters.eventCategory, edge.eventCategory)) {
      return false;
    }
    if (filters.relationshipType && edge.relationshipType !== filters.relationshipType) {
      return false;
    }
    if (
      filters.q &&
      !matchesAny(filters.q, [
        sourceGroup.name,
        sourceGroup.theme.name,
        targetGroup.name,
        targetGroup.theme.name,
        edge.relationshipType,
        edge.macroSensitivity,
        edge.eventCategory,
        edge.notes,
        JSON.stringify(edge.evidenceJson ?? {}),
      ])
    ) {
      return false;
    }
    return true;
  }

  private matchesCatalystFilters(
    catalyst: CatalystRow,
    groupById: Map<string, GroupRow> | undefined,
    selectedGroupIds: Set<string> | undefined,
    filters: RelationshipGraphFilters,
  ): boolean {
    const group = catalyst.groupId
      ? (groupById?.get(catalyst.groupId) ?? catalyst.group)
      : null;
    if (
      filters.theme &&
      !matchesAny(filters.theme, [catalyst.themeId, catalyst.theme?.name])
    ) {
      return false;
    }
    if (filters.group && !matchesAny(filters.group, [catalyst.groupId, group?.name])) {
      return false;
    }
    if (filters.layer && group?.layer !== filters.layer) {
      return false;
    }
    if (selectedGroupIds && catalyst.groupId && !selectedGroupIds.has(catalyst.groupId)) {
      return false;
    }
    if (
      filters.q &&
      !matchesAny(filters.q, [
        catalyst.title,
        catalyst.hypothesis,
        catalyst.theme?.name,
        group?.name,
        JSON.stringify(catalyst.expectedBeneficiariesJson ?? {}),
        JSON.stringify(catalyst.expectedLosersJson ?? {}),
        JSON.stringify(catalyst.evidenceJson ?? {}),
      ])
    ) {
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
        const membership =
          stock.themeMemberships.find(
            (item) => item.groupId === group.id || item.themeId === group.themeId,
          ) ?? null;
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
      status: catalyst.status,
      confidenceScore: catalyst.confidenceScore?.toString() ?? null,
      beneficiaries: catalyst.expectedBeneficiariesJson,
      losers: catalyst.expectedLosersJson,
      evidence: normalizeEvidence(catalyst.evidenceJson ?? catalyst.sourceUrlsJson),
    };
  }
}

function normalizeFilters(
  filters: RelationshipGraphFilters,
): RelationshipGraphFilters {
  return {
    theme: trim(filters.theme),
    group: trim(filters.group),
    layer: filters.layer,
    eventCategory: trim(filters.eventCategory),
    relationshipType: filters.relationshipType,
    q: trim(filters.q),
  };
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
