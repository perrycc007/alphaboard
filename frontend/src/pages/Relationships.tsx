import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitBranch, Loader2, Network, Search } from 'lucide-react'
import {
  fetchRelationshipGraph,
  type RelationshipCatalyst,
  type RelationshipEdge,
  type RelationshipEvidence,
  type RelationshipGraph,
  type RelationshipGraphFilters,
  type RelationshipGroup,
  type RelationshipStock,
  type SupplyChainLayer,
} from '@/lib/api/research'
import {
  buildGraphNodes,
  catalystNamesForGroup,
  edgeEndpoints,
  evidenceSourceCount,
  evidenceSources,
  formatRelationshipLabel,
  graphFacets,
  graphIsEmpty,
  groupStocksByLayer,
} from './relationship-graph.selectors'

const EMPTY_GRAPH: RelationshipGraph = {
  themes: [],
  groups: [],
  stocks: [],
  edges: [],
  catalysts: [],
}

const RELATIONSHIP_TYPES = ['LEADS', 'LAGS', 'BENEFITS', 'HURTS', 'COMPETES', 'SUPPLIER_TO']

export default function Relationships() {
  const [graph, setGraph] = useState<RelationshipGraph>(EMPTY_GRAPH)
  const [filters, setFilters] = useState<RelationshipGraphFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setGraph(await fetchRelationshipGraph(filters))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load relationships')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const facets = useMemo(() => graphFacets(graph), [graph])
  const groupsById = useMemo(() => new Map(graph.groups.map((group) => [group.id, group])), [graph.groups])
  const groupedStocks = useMemo(() => groupStocksByLayer(graph), [graph])
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Network className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Relationships
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{graph.groups.length} groups</span>
          <span>{graph.edges.length} edges</span>
          <span>{graph.stocks.length} stocks</span>
        </div>
      </div>

      <FilterBar facets={facets} filters={filters} onChange={setFilters} />

      {error && (
        <div className="rounded-lg border border-bearish/30 bg-bearish/10 px-3 py-2 text-xs text-bearish sm:text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : graphIsEmpty(graph) ? (
        <EmptyState filtered={hasFilters} />
      ) : (
        <>
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <GraphPreview groups={graph.groups} edges={graph.edges} />
            <CatalystPanel catalysts={graph.catalysts} groupsById={groupsById} />
          </section>

          <RelationshipTable edges={graph.edges} groupsById={groupsById} />
          <StockLayerTable groupedStocks={groupedStocks} catalysts={graph.catalysts} />
        </>
      )}
    </div>
  )
}

function FilterBar({
  facets,
  filters,
  onChange,
}: {
  facets: ReturnType<typeof graphFacets>
  filters: RelationshipGraphFilters
  onChange: (filters: RelationshipGraphFilters) => void
}) {
  const set = (patch: RelationshipGraphFilters) =>
    onChange({
      ...filters,
      ...patch,
    })
  return (
    <section className="grid gap-2 rounded-lg border border-border-default bg-bg-surface p-3 md:grid-cols-[1.2fr_repeat(4,minmax(130px,0.7fr))_auto]">
      <label className="flex items-center gap-2 rounded-md border border-border-muted bg-bg-base px-2 py-1.5">
        <Search className="h-4 w-4 text-text-muted" />
        <input
          value={filters.q ?? ''}
          onChange={(event) => set({ q: event.target.value || undefined })}
          placeholder="Search ticker, group, catalyst"
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
        />
      </label>
      <SelectFilter
        value={filters.theme}
        label="Theme"
        options={facets.themes}
        onChange={(theme) => set({ theme })}
      />
      <SelectFilter
        value={filters.layer}
        label="Layer"
        options={facets.layers}
        onChange={(layer) => set({ layer: layer as SupplyChainLayer | undefined })}
      />
      <SelectFilter
        value={filters.relationshipType}
        label="Type"
        options={RELATIONSHIP_TYPES}
        onChange={(relationshipType) => set({ relationshipType })}
      />
      <SelectFilter
        value={filters.eventCategory}
        label="Event"
        options={facets.eventCategories}
        onChange={(eventCategory) => set({ eventCategory })}
      />
      <button
        onClick={() => onChange({})}
        className="rounded-md border border-border-muted px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
      >
        Clear
      </button>
    </section>
  )
}

function SelectFilter({
  value,
  label,
  options,
  disabled,
  onChange,
}: {
  value?: string
  label: string
  options: string[]
  disabled?: boolean
  onChange: (value: string | undefined) => void
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-medium uppercase text-text-muted">{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="h-8 rounded-md border border-border-muted bg-bg-base px-2 text-xs text-text-primary outline-none disabled:opacity-50"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatRelationshipLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function GraphPreview({
  groups,
  edges,
}: {
  groups: RelationshipGroup[]
  edges: RelationshipEdge[]
}) {
  const nodes = buildGraphNodes(groups)
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-accent" />
        <h2 className="font-heading text-sm font-semibold text-text-primary">Graph Preview</h2>
      </div>
      <div className="mt-3 aspect-[16/9] min-h-72 overflow-hidden rounded-md border border-border-muted bg-bg-base">
        <svg viewBox="0 0 100 100" role="img" aria-label="Supply chain relationship graph" className="h-full w-full">
          {edges.map((edge) => {
            const source = nodesById.get(edge.sourceGroupId)
            const target = nodesById.get(edge.targetGroupId)
            if (!source || !target) return null
            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="currentColor"
                strokeWidth="0.35"
                className="text-border-default"
              />
            )
          })}
          {nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r="2.2"
                className={nodeTone(node.layer)}
              />
              <text x={node.x + 3} y={node.y + 1} className="fill-text-secondary text-[2.5px]">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Array.from(new Set(groups.map((group) => group.layer).filter(Boolean))).map((layer) => (
          <StatusPill key={layer} label={formatRelationshipLabel(layer)} tone="neutral" />
        ))}
      </div>
      {edges.length === 0 && groups.length > 0 && (
        <div className="mt-3 text-xs text-text-muted">Groups loaded, no visible relationship edges.</div>
      )}
    </section>
  )
}

function RelationshipTable({
  edges,
  groupsById,
}: {
  edges: RelationshipEdge[]
  groupsById: Map<string, RelationshipGroup>
}) {
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <h2 className="font-heading text-sm font-semibold text-text-primary">Relationship Edges</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="text-text-muted">
            <tr className="border-b border-border-muted">
              <th className="py-2 pr-3 font-medium">Source</th>
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 pr-3 font-medium">Target</th>
              <th className="py-2 pr-3 font-medium">Event</th>
              <th className="py-2 pr-3 font-medium">Macro</th>
              <th className="py-2 pr-3 font-medium">Strength</th>
              <th className="py-2 pr-3 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge) => {
              const { source, target } = edgeEndpoints(edge, groupsById)
              return (
                <tr key={edge.id} className="border-b border-border-muted/50 align-top">
                  <td className="py-2 pr-3 text-text-primary">
                    <GroupName group={source} />
                  </td>
                  <td className="py-2 pr-3">
                    <StatusPill label={formatRelationshipLabel(edge.relationshipType)} tone={relationshipTone(edge.relationshipType)} />
                  </td>
                  <td className="py-2 pr-3 text-text-primary">
                    <GroupName group={target} />
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">{formatRelationshipLabel(edge.eventCategory)}</td>
                  <td className="py-2 pr-3 text-text-secondary">{formatRelationshipLabel(edge.macroSensitivity)}</td>
                  <td className="py-2 pr-3 font-mono text-text-primary">{formatStrength(edge.strengthScore)}</td>
                  <td className="py-2 pr-3">
                    <EvidenceDetails evidence={edge.evidence} notes={edge.notes} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {edges.length === 0 && <div className="mt-3 text-xs text-text-muted">No relationship edges match the current filters.</div>}
    </section>
  )
}

function StockLayerTable({
  groupedStocks,
  catalysts,
}: {
  groupedStocks: ReturnType<typeof groupStocksByLayer>
  catalysts: RelationshipCatalyst[]
}) {
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <h2 className="font-heading text-sm font-semibold text-text-primary">Stocks By Supply Chain</h2>
      <div className="mt-3 space-y-4">
        {groupedStocks.map((layerRow) => (
          <div key={layerRow.layer}>
            <div className="mb-2 flex items-center gap-2">
              <StatusPill label={formatRelationshipLabel(layerRow.layer)} tone="neutral" />
              <span className="text-xs text-text-muted">{layerRow.groups.length} groups</span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {layerRow.groups.map(({ group, stocks }) => (
                <div key={group.id} className="rounded-md border border-border-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <GroupName group={group} />
                    <span className="text-[10px] text-text-muted">{evidenceSourceCount(group.evidence)} src</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {stocks.length > 0 ? (
                      stocks.map((stock) => <StockChip key={`${group.id}-${stock.id}`} stock={stock} />)
                    ) : (
                      <span className="text-xs text-text-muted">No linked stocks</span>
                    )}
                  </div>
                  {catalystNamesForGroup(catalysts, group.id).length > 0 && (
                    <div className="mt-2 text-[11px] text-warning">
                      {catalystNamesForGroup(catalysts, group.id).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {groupedStocks.length === 0 && <div className="mt-3 text-xs text-text-muted">No stock memberships match the current filters.</div>}
    </section>
  )
}

function CatalystPanel({
  catalysts,
  groupsById,
}: {
  catalysts: RelationshipCatalyst[]
  groupsById: Map<string, RelationshipGroup>
}) {
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <h2 className="font-heading text-sm font-semibold text-text-primary">Catalysts</h2>
      <div className="mt-3 space-y-3">
        {catalysts.map((catalyst) => (
          <div key={catalyst.id} className="rounded-md border border-border-muted p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-heading text-sm font-semibold text-text-primary">{catalyst.title}</div>
                {catalyst.groupId && (
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    {groupsById.get(catalyst.groupId)?.themeName} / {groupsById.get(catalyst.groupId)?.name}
                  </div>
                )}
              </div>
              <StatusPill label={catalyst.status.toLowerCase()} tone={catalyst.status === 'CONFIRMED' ? 'bull' : 'warn'} />
            </div>
            <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
              <CatalystList label="Benefits" value={catalyst.beneficiaries} tone="text-bullish" />
              <CatalystList label="Risks" value={catalyst.losers} tone="text-bearish" />
            </div>
            <div className="mt-2">
              <EvidenceDetails evidence={catalyst.evidence} />
            </div>
          </div>
        ))}
      </div>
      {catalysts.length === 0 && <div className="mt-3 text-xs text-text-muted">No catalyst hypotheses match the current filters.</div>}
    </section>
  )
}

function CatalystList({ label, value, tone }: { label: string; value: unknown; tone: string }) {
  const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return (
    <div>
      <span className="text-text-muted">{label}: </span>
      <span className={tone}>{items.length > 0 ? items.slice(0, 7).join(', ') : '-'}</span>
    </div>
  )
}

function EvidenceDetails({ evidence, notes }: { evidence: RelationshipEvidence; notes?: string | null }) {
  const sources = evidenceSources(evidence)
  const count = evidenceSourceCount(evidence)
  if (count === 0 && !notes) return <span className="text-xs text-text-muted">No evidence</span>
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs text-accent hover:text-accent-hover">
        {count} source{count === 1 ? '' : 's'}
      </summary>
      <div className="mt-2 space-y-1 text-[11px] text-text-muted">
        {notes && <div>{notes}</div>}
        {sources.map((source, index) => (
          source.url ? (
            <a
              key={`${source.url}-${index}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-accent hover:text-accent-hover"
            >
              {source.title ?? source.key ?? source.url}
            </a>
          ) : (
            <div key={`${source.title}-${index}`}>{source.title ?? source.key}</div>
          )
        ))}
      </div>
    </details>
  )
}

function GroupName({ group }: { group?: RelationshipGroup }) {
  if (!group) return <span className="text-text-muted">Unknown</span>
  return (
    <span>
      <span className="font-medium text-text-primary">{group.name}</span>
      <span className="block text-[10px] text-text-muted">{group.themeName}</span>
    </span>
  )
}

function StockChip({ stock }: { stock: RelationshipStock }) {
  return (
    <span
      className="rounded-md border border-border-muted px-2 py-0.5 text-[11px] text-text-secondary"
      title={`${stock.name}${stock.role ? ` / ${stock.role}` : ''}`}
    >
      <span className="font-mono text-text-primary">{stock.ticker}</span>
      {stock.role && <span className="ml-1 text-text-muted">{stock.role}</span>}
    </span>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-border-default bg-bg-surface">
      <span className="text-xs text-text-muted sm:text-sm">
        {filtered ? 'No relationships match the current filters.' : 'No relationship data has been imported yet.'}
      </span>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'bull' | 'bear' | 'warn' | 'neutral' }) {
  const color =
    tone === 'bull'
      ? 'bg-bullish/10 text-bullish'
      : tone === 'bear'
        ? 'bg-bearish/10 text-bearish'
        : tone === 'warn'
          ? 'bg-warning-muted text-warning'
          : 'bg-secondary text-text-secondary'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${color}`}>{label}</span>
}

function relationshipTone(type: string): 'bull' | 'bear' | 'warn' | 'neutral' {
  if (type === 'BENEFITS' || type === 'SUPPLIER_TO' || type === 'LEADS') return 'bull'
  if (type === 'HURTS') return 'bear'
  if (type === 'COMPETES') return 'warn'
  return 'neutral'
}

function nodeTone(layer: SupplyChainLayer | null): string {
  switch (layer) {
    case 'INPUT':
      return 'fill-warning'
    case 'EQUIPMENT':
      return 'fill-accent'
    case 'COMPONENT':
      return 'fill-bullish'
    case 'INFRASTRUCTURE':
      return 'fill-text-primary'
    case 'APPLICATION':
      return 'fill-bearish'
    default:
      return 'fill-text-muted'
  }
}

function formatStrength(value: string | null) {
  const numeric = value == null ? null : Number(value)
  return Number.isFinite(numeric) && numeric != null ? `${Math.round(numeric * 100)}%` : '-'
}
