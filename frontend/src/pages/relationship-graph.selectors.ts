import type {
  RelationshipCatalyst,
  RelationshipEdge,
  RelationshipEvidence,
  RelationshipGraph,
  RelationshipGroup,
  RelationshipImpact,
  RelationshipMechanism,
  RelationshipStock,
  SupplyChainLayer,
} from '@/lib/api/research'

export const SUPPLY_CHAIN_LAYER_ORDER: SupplyChainLayer[] = [
  'INPUT',
  'EQUIPMENT',
  'COMPONENT',
  'INFRASTRUCTURE',
  'PLATFORM',
  'APPLICATION',
  'DISTRIBUTION',
  'END_MARKET',
  'FINANCING',
]

export interface GraphNode {
  id: string
  label: string
  themeName: string
  layer: SupplyChainLayer | null
  x: number
  y: number
}

export type ChainNodeKind = 'CATALYST' | 'MECHANISM' | 'IMPACT'
export type ImpactDirection = RelationshipImpact['direction']

export interface CatalystChainNode {
  id: string
  kind: ChainNodeKind
  label: string
  direction?: ImpactDirection
  mechanismId?: string
  impactId?: string
  groupId?: string
  x: number
  y: number
}

export interface CatalystChainEdge {
  id: string
  sourceId: string
  targetId: string
  direction?: ImpactDirection
}

export interface CatalystChainLayout {
  nodes: CatalystChainNode[]
  edges: CatalystChainEdge[]
}

export interface GroupedStockRows {
  layer: SupplyChainLayer | 'UNLAYERED'
  groups: Array<{
    group: RelationshipGroup
    stocks: RelationshipStock[]
  }>
}

const IMPACT_DIRECTION_ORDER: ImpactDirection[] = ['BENEFITS', 'HARMS', 'MIXED']

export function formatRelationshipLabel(value: string | null | undefined): string {
  return value ? value.replace(/_/g, ' ').toLowerCase() : '-'
}

export function evidenceSourceCount(evidence: RelationshipEvidence | null | undefined): number {
  if (!evidence) return 0
  const sourceIds = new Set<string>()
  for (const source of evidence.sources ?? []) {
    if (source.key) sourceIds.add(source.key)
    else if (source.url) sourceIds.add(source.url)
    else if (source.title) sourceIds.add(source.title)
  }
  for (const key of evidence.sourceKeys ?? []) sourceIds.add(key)
  return sourceIds.size
}

export function evidenceSources(evidence: RelationshipEvidence | null | undefined) {
  return evidence?.sources?.filter((source) => source.url || source.title || source.key) ?? []
}

export function groupStocksByLayer(graph: RelationshipGraph): GroupedStockRows[] {
  const stocksByGroup = new Map<string, RelationshipStock[]>()
  for (const stock of graph.stocks) {
    for (const groupId of stock.groupIds) {
      const list = stocksByGroup.get(groupId) ?? []
      list.push(stock)
      stocksByGroup.set(groupId, list)
    }
  }

  const rows = graph.groups.map((group) => ({
    group,
    stocks: (stocksByGroup.get(group.id) ?? []).sort((a, b) => a.ticker.localeCompare(b.ticker)),
  }))

  const byLayer = new Map<SupplyChainLayer | 'UNLAYERED', GroupedStockRows['groups']>()
  for (const row of rows) {
    const layer = row.group.layer ?? 'UNLAYERED'
    const list = byLayer.get(layer) ?? []
    list.push(row)
    byLayer.set(layer, list)
  }

  return [...byLayer.entries()]
    .map(([layer, groups]) => ({
      layer,
      groups: groups.sort((a, b) => groupSort(a.group, b.group)),
    }))
    .sort((a, b) => layerRank(a.layer) - layerRank(b.layer))
}

export function groupAffectedStocksByLayer(graph: RelationshipGraph): GroupedStockRows[] {
  const impactedGroupIds = new Set(graph.impacts.map((impact) => impact.groupId))
  return groupStocksByLayer({
    ...graph,
    groups: graph.groups.filter((group) => impactedGroupIds.has(group.id)),
  })
}

export function sortImpactsForTable(impacts: RelationshipImpact[]): RelationshipImpact[] {
  return [...impacts].sort((a, b) => {
    const directionDelta = directionRank(a.direction) - directionRank(b.direction)
    if (directionDelta !== 0) return directionDelta
    return strengthValue(b.strengthScore) - strengthValue(a.strengthScore)
  })
}

export function buildCatalystChainLayout(
  catalyst: RelationshipCatalyst | undefined,
  mechanisms: RelationshipMechanism[],
  impacts: RelationshipImpact[],
  groupsById: Map<string, RelationshipGroup>,
): CatalystChainLayout {
  if (!catalyst) return { nodes: [], edges: [] }

  const nodes: CatalystChainNode[] = [
    {
      id: catalyst.id,
      kind: 'CATALYST',
      label: catalyst.title,
      x: 8,
      y: 50,
    },
  ]
  const edges: CatalystChainEdge[] = []
  const mechanismImpacts = new Map<string, RelationshipImpact[]>()

  for (const impact of sortImpactsForTable(impacts)) {
    const list = mechanismImpacts.get(impact.mechanismId) ?? []
    list.push(impact)
    mechanismImpacts.set(impact.mechanismId, list)
  }

  const visibleMechanisms = mechanisms.filter((mechanism) =>
    mechanismImpacts.has(mechanism.id),
  )

  visibleMechanisms.forEach((mechanism, index) => {
    const y = spreadPosition(index, visibleMechanisms.length, 18, 82)
    nodes.push({
      id: mechanism.id,
      kind: 'MECHANISM',
      label: mechanism.title,
      x: 36,
      y,
    })
    edges.push({
      id: `${catalyst.id}-${mechanism.id}`,
      sourceId: catalyst.id,
      targetId: mechanism.id,
    })
  })

  const lanes = new Map<ImpactDirection, RelationshipImpact[]>()
  for (const impact of sortImpactsForTable(impacts)) {
    const list = lanes.get(impact.direction) ?? []
    list.push(impact)
    lanes.set(impact.direction, list)
  }

  const laneX: Record<ImpactDirection, number> = {
    BENEFITS: 72,
    HARMS: 72,
    MIXED: 72,
  }
  const laneBounds: Record<ImpactDirection, [number, number]> = {
    BENEFITS: [10, 34],
    HARMS: [41, 65],
    MIXED: [72, 92],
  }

  for (const direction of IMPACT_DIRECTION_ORDER) {
    const laneImpacts = lanes.get(direction) ?? []
    laneImpacts.forEach((impact, index) => {
      const group = groupsById.get(impact.groupId)
      const [minY, maxY] = laneBounds[direction]
      const nodeId = impactNodeId(impact)
      nodes.push({
        id: nodeId,
        kind: 'IMPACT',
        label: group?.name ?? 'Unknown group',
        direction: impact.direction,
        mechanismId: impact.mechanismId,
        impactId: impact.id,
        groupId: impact.groupId,
        x: laneX[direction],
        y: spreadPosition(index, laneImpacts.length, minY, maxY),
      })
      edges.push({
        id: `${impact.mechanismId}-${impact.id}`,
        sourceId: impact.mechanismId,
        targetId: nodeId,
        direction: impact.direction,
      })
    })
  }

  return { nodes, edges }
}

export function buildGraphNodes(groups: RelationshipGroup[]): GraphNode[] {
  const byLayer = new Map<string, RelationshipGroup[]>()
  for (const group of groups) {
    const key = group.layer ?? 'UNLAYERED'
    const list = byLayer.get(key) ?? []
    list.push(group)
    byLayer.set(key, list)
  }

  const layers = [...byLayer.keys()].sort((a, b) => layerRank(a) - layerRank(b))
  return layers.flatMap((layer, layerIndex) => {
    const layerGroups = [...(byLayer.get(layer) ?? [])].sort(groupSort)
    return layerGroups.map((group, index) => ({
      id: group.id,
      label: group.name,
      themeName: group.themeName,
      layer: group.layer,
      x: layers.length <= 1 ? 50 : 8 + (layerIndex * 84) / (layers.length - 1),
      y: layerGroups.length <= 1 ? 50 : 12 + (index * 76) / (layerGroups.length - 1),
    }))
  })
}

export function graphFacets(graph: RelationshipGraph) {
  return {
    catalystKinds: unique(graph.catalysts.map((catalyst) => catalyst.kind)),
    themes: unique(graph.groups.map((group) => group.themeName)),
    layers: SUPPLY_CHAIN_LAYER_ORDER.filter((layer) =>
      graph.groups.some((group) => group.layer === layer),
    ),
    relationshipTypes: unique(graph.edges.map((edge) => edge.relationshipType)),
    eventCategories: unique([
      ...graph.edges.map((edge) => edge.eventCategory),
      ...graph.catalysts.map((catalyst) => catalyst.eventCategory),
    ]),
  }
}

export function graphIsEmpty(graph: RelationshipGraph): boolean {
  return graph.groups.length === 0 && graph.impacts.length === 0 && graph.stocks.length === 0
}

export function catalystNamesForGroup(
  catalysts: RelationshipCatalyst[],
  groupId: string,
): string[] {
  return catalysts
    .filter((catalyst) => catalyst.groupId === groupId)
    .map((catalyst) => catalyst.title)
}

export function edgeEndpoints(
  edge: RelationshipEdge,
  groupsById: Map<string, RelationshipGroup>,
) {
  return {
    source: groupsById.get(edge.sourceGroupId),
    target: groupsById.get(edge.targetGroupId),
  }
}

function layerRank(layer: string | null): number {
  const index = SUPPLY_CHAIN_LAYER_ORDER.indexOf(layer as SupplyChainLayer)
  return index === -1 ? SUPPLY_CHAIN_LAYER_ORDER.length : index
}

function directionRank(direction: ImpactDirection): number {
  const index = IMPACT_DIRECTION_ORDER.indexOf(direction)
  return index === -1 ? IMPACT_DIRECTION_ORDER.length : index
}

function strengthValue(value: string | null): number {
  const numeric = value == null ? 0 : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function spreadPosition(index: number, count: number, min: number, max: number): number {
  if (count <= 1) return (min + max) / 2
  return min + (index * (max - min)) / (count - 1)
}

function impactNodeId(impact: RelationshipImpact): string {
  return `impact-${impact.id}`
}

function groupSort(a: RelationshipGroup, b: RelationshipGroup): number {
  return (
    a.themeName.localeCompare(b.themeName) ||
    layerRank(a.layer) - layerRank(b.layer) ||
    a.name.localeCompare(b.name)
  )
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b),
  )
}
