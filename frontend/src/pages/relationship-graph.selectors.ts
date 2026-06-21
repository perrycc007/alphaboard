import type {
  RelationshipCatalyst,
  RelationshipEdge,
  RelationshipEvidence,
  RelationshipGraph,
  RelationshipGroup,
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

export interface GroupedStockRows {
  layer: SupplyChainLayer | 'UNLAYERED'
  groups: Array<{
    group: RelationshipGroup
    stocks: RelationshipStock[]
  }>
}

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
    themes: unique(graph.groups.map((group) => group.themeName)),
    layers: SUPPLY_CHAIN_LAYER_ORDER.filter((layer) =>
      graph.groups.some((group) => group.layer === layer),
    ),
    relationshipTypes: unique(graph.edges.map((edge) => edge.relationshipType)),
    eventCategories: unique(graph.edges.map((edge) => edge.eventCategory).filter(Boolean)),
  }
}

export function graphIsEmpty(graph: RelationshipGraph): boolean {
  return graph.groups.length === 0 && graph.edges.length === 0 && graph.stocks.length === 0
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
