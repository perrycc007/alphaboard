import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitBranch, Loader2, MousePointer2, Network, Search } from 'lucide-react'
import {
  fetchRelationshipGraph,
  type CatalystKind,
  type RelationshipCatalyst,
  type RelationshipEvidence,
  type RelationshipGraph,
  type RelationshipGraphFilters,
  type RelationshipGroup,
  type RelationshipImpact,
  type RelationshipMechanism,
  type RelationshipStock,
} from '@/lib/api/research'
import {
  buildCatalystChainLayout,
  evidenceSourceCount,
  evidenceSources,
  formatRelationshipLabel,
  graphFacets,
  graphIsEmpty,
  groupAffectedStocksByLayer,
  sortImpactsForTable,
} from './relationship-graph.selectors'

const EMPTY_GRAPH: RelationshipGraph = {
  selectedCatalystId: null,
  themes: [],
  groups: [],
  stocks: [],
  edges: [],
  catalysts: [],
  mechanisms: [],
  impacts: [],
}

const CATALYST_KINDS: CatalystKind[] = ['CURRENT', 'HISTORICAL', 'PATTERN']

export default function Relationships() {
  const [graph, setGraph] = useState<RelationshipGraph>(EMPTY_GRAPH)
  const [filters, setFilters] = useState<RelationshipGraphFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredImpactId, setHoveredImpactId] = useState<string | null>(null)
  const [lockedImpactId, setLockedImpactId] = useState<string | null>(null)

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

  useEffect(() => {
    if (lockedImpactId && !graph.impacts.some((impact) => impact.id === lockedImpactId)) {
      setLockedImpactId(null)
    }
    if (hoveredImpactId && !graph.impacts.some((impact) => impact.id === hoveredImpactId)) {
      setHoveredImpactId(null)
    }
  }, [graph.impacts, hoveredImpactId, lockedImpactId])

  const facets = useMemo(() => graphFacets(graph), [graph])
  const groupsById = useMemo(() => new Map(graph.groups.map((group) => [group.id, group])), [graph.groups])
  const mechanismsById = useMemo(
    () => new Map(graph.mechanisms.map((mechanism) => [mechanism.id, mechanism])),
    [graph.mechanisms],
  )
  const selectedCatalyst = useMemo(
    () => graph.catalysts.find((catalyst) => catalyst.id === graph.selectedCatalystId),
    [graph.catalysts, graph.selectedCatalystId],
  )
  const sortedImpacts = useMemo(() => sortImpactsForTable(graph.impacts), [graph.impacts])
  const activeImpact = useMemo(
    () => sortedImpacts.find((impact) => impact.id === (lockedImpactId ?? hoveredImpactId)),
    [hoveredImpactId, lockedImpactId, sortedImpacts],
  )
  const visibleImpacts = lockedImpactId
    ? sortedImpacts.filter((impact) => impact.id === lockedImpactId)
    : sortedImpacts
  const groupedStocks = useMemo(() => groupAffectedStocksByLayer(graph), [graph])
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Network className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
            Relationships
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{graph.catalysts.length} catalysts</span>
          <span>{graph.impacts.length} impacts</span>
          <span>{graph.stocks.length} stocks</span>
        </div>
      </header>

      <FilterBar
        catalysts={graph.catalysts}
        facets={facets}
        filters={filters}
        selectedCatalystId={graph.selectedCatalystId}
        onChange={(nextFilters) => {
          setLockedImpactId(null)
          setHoveredImpactId(null)
          setFilters(nextFilters)
        }}
      />

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
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
            <CatalystChainGraph
              catalyst={selectedCatalyst}
              mechanisms={graph.mechanisms}
              impacts={sortedImpacts}
              groupsById={groupsById}
              activeImpactId={lockedImpactId ?? hoveredImpactId}
              lockedImpactId={lockedImpactId}
              onHoverImpact={setHoveredImpactId}
              onLockImpact={(impactId) =>
                setLockedImpactId((current) => (current === impactId ? null : impactId))
              }
            />
            <ImpactDetails
              catalyst={selectedCatalyst}
              impact={activeImpact}
              mechanism={activeImpact ? mechanismsById.get(activeImpact.mechanismId) : undefined}
              group={activeImpact ? groupsById.get(activeImpact.groupId) : undefined}
              locked={Boolean(lockedImpactId)}
              onClearLock={() => setLockedImpactId(null)}
            />
          </section>

          <ImpactTable
            impacts={visibleImpacts}
            allCount={sortedImpacts.length}
            groupsById={groupsById}
            mechanismsById={mechanismsById}
            locked={Boolean(lockedImpactId)}
            activeImpactId={lockedImpactId ?? hoveredImpactId}
            onHoverImpact={setHoveredImpactId}
            onLockImpact={(impactId) =>
              setLockedImpactId((current) => (current === impactId ? null : impactId))
            }
            onClearLock={() => setLockedImpactId(null)}
          />

          <StockLayerTable groupedStocks={groupedStocks} />
        </>
      )}
    </div>
  )
}

function FilterBar({
  catalysts,
  facets,
  filters,
  selectedCatalystId,
  onChange,
}: {
  catalysts: RelationshipCatalyst[]
  facets: ReturnType<typeof graphFacets>
  filters: RelationshipGraphFilters
  selectedCatalystId: string | null
  onChange: (filters: RelationshipGraphFilters) => void
}) {
  const set = (patch: RelationshipGraphFilters) =>
    onChange({
      ...filters,
      ...patch,
    })
  return (
    <section className="grid gap-2 rounded-lg border border-border-default bg-bg-surface p-3 md:grid-cols-[minmax(220px,1.6fr)_repeat(2,minmax(130px,0.55fr))_minmax(180px,0.9fr)_auto]">
      <label className="grid gap-1">
        <span className="text-[10px] font-medium uppercase text-text-muted">Catalyst</span>
        <select
          value={filters.catalystId ?? selectedCatalystId ?? ''}
          onChange={(event) => set({ catalystId: event.target.value || undefined })}
          className="h-8 rounded-md border border-border-muted bg-bg-base px-2 text-xs text-text-primary outline-none"
        >
          <option value="">Auto select</option>
          {catalysts.map((catalyst) => (
            <option key={catalyst.id} value={catalyst.id}>
              {catalyst.title}
            </option>
          ))}
        </select>
      </label>
      <SelectFilter
        value={filters.kind}
        label="Kind"
        options={facets.catalystKinds.length > 0 ? facets.catalystKinds : CATALYST_KINDS}
        onChange={(kind) => onChange({ ...filters, kind: kind as CatalystKind | undefined, catalystId: undefined })}
      />
      <SelectFilter
        value={filters.eventCategory}
        label="Event"
        options={facets.eventCategories}
        onChange={(eventCategory) => set({ eventCategory, catalystId: undefined })}
      />
      <label className="flex items-center gap-2 rounded-md border border-border-muted bg-bg-base px-2 py-1.5 md:mt-4">
        <Search className="h-4 w-4 text-text-muted" />
        <input
          value={filters.q ?? ''}
          onChange={(event) => set({ q: event.target.value || undefined, catalystId: undefined })}
          placeholder="Search ticker, group, mechanism"
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
        />
      </label>
      <button
        onClick={() => onChange({})}
        className="h-8 self-end rounded-md border border-border-muted px-3 text-xs text-text-secondary hover:text-text-primary"
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
  onChange,
}: {
  value?: string
  label: string
  options: string[]
  onChange: (value: string | undefined) => void
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-medium uppercase text-text-muted">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="h-8 rounded-md border border-border-muted bg-bg-base px-2 text-xs text-text-primary outline-none"
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

function CatalystChainGraph({
  catalyst,
  mechanisms,
  impacts,
  groupsById,
  activeImpactId,
  lockedImpactId,
  onHoverImpact,
  onLockImpact,
}: {
  catalyst?: RelationshipCatalyst
  mechanisms: RelationshipMechanism[]
  impacts: RelationshipImpact[]
  groupsById: Map<string, RelationshipGroup>
  activeImpactId: string | null
  lockedImpactId: string | null
  onHoverImpact: (impactId: string | null) => void
  onLockImpact: (impactId: string) => void
}) {
  const layout = useMemo(
    () => buildCatalystChainLayout(catalyst, mechanisms, impacts, groupsById),
    [catalyst, groupsById, impacts, mechanisms],
  )
  const nodesById = new Map(layout.nodes.map((node) => [node.id, node]))
  const activeNodeId = activeImpactId ? `impact-${activeImpactId}` : null

  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-text-primary">Catalyst Chain</h2>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-text-muted">
          <MousePointer2 className="h-3.5 w-3.5" />
          <span>{lockedImpactId ? 'locked' : 'hover or click'}</span>
        </div>
      </div>
      <div className="mt-3 hidden aspect-[16/9] min-h-80 overflow-hidden rounded-md border border-border-muted bg-bg-base md:block">
        <svg viewBox="0 0 100 100" role="img" aria-label="Catalyst chain relationship graph" className="h-full w-full">
          <LaneBand y="8" height="28" label="Benefits" tone="bull" />
          <LaneBand y="39" height="28" label="Harms" tone="bear" />
          <LaneBand y="70" height="24" label="Mixed" tone="warn" />
          {layout.edges.map((edge) => {
            const source = nodesById.get(edge.sourceId)
            const target = nodesById.get(edge.targetId)
            if (!source || !target) return null
            return (
              <line
                key={edge.id}
                x1={source.x + 5}
                y1={source.y}
                x2={target.x - 5}
                y2={target.y}
                stroke="currentColor"
                strokeWidth={edge.targetId === activeNodeId ? '0.8' : '0.35'}
                className={edgeTone(edge.direction)}
              />
            )
          })}
          {layout.nodes.map((node) => (
            <g
              key={node.id}
              role={node.kind === 'IMPACT' ? 'button' : undefined}
              tabIndex={node.kind === 'IMPACT' ? 0 : undefined}
              onMouseEnter={() => node.impactId && onHoverImpact(node.impactId)}
              onMouseLeave={() => onHoverImpact(null)}
              onClick={() => node.impactId && onLockImpact(node.impactId)}
              className={node.kind === 'IMPACT' ? 'cursor-pointer outline-none' : undefined}
            >
              <rect
                x={node.x - nodeWidth(node) / 2}
                y={node.y - 4.2}
                width={nodeWidth(node)}
                height="8.4"
                rx="1.2"
                className={`${nodeFill(node)} ${node.id === activeNodeId ? 'stroke-accent stroke-[0.7]' : 'stroke-border-muted stroke-[0.25]'}`}
              />
              <title>{node.label}</title>
              <text
                x={node.x}
                y={node.y + 0.9}
                textAnchor="middle"
                className="pointer-events-none fill-text-primary text-[2.3px] font-medium"
              >
                {truncate(node.label, node.kind === 'CATALYST' ? 20 : 18)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 space-y-3 md:hidden">
        <MobileChainList
          catalyst={catalyst}
          mechanisms={mechanisms}
          impacts={impacts}
          groupsById={groupsById}
          activeImpactId={activeImpactId}
          onLockImpact={onLockImpact}
        />
      </div>
    </section>
  )
}

function LaneBand({ y, height, label, tone }: { y: string; height: string; label: string; tone: 'bull' | 'bear' | 'warn' }) {
  const color =
    tone === 'bull'
      ? 'fill-bullish/5 text-bullish'
      : tone === 'bear'
        ? 'fill-bearish/5 text-bearish'
        : 'fill-warning-muted/20 text-warning'
  return (
    <g>
      <rect x="59" y={y} width="36" height={height} rx="1.5" className={color} />
      <text x="61" y={Number(y) + 4} className={`fill-current text-[2.2px] uppercase ${color}`}>
        {label}
      </text>
    </g>
  )
}

function MobileChainList({
  catalyst,
  mechanisms,
  impacts,
  groupsById,
  activeImpactId,
  onLockImpact,
}: {
  catalyst?: RelationshipCatalyst
  mechanisms: RelationshipMechanism[]
  impacts: RelationshipImpact[]
  groupsById: Map<string, RelationshipGroup>
  activeImpactId: string | null
  onLockImpact: (impactId: string) => void
}) {
  return (
    <>
      <div className="rounded-md border border-border-muted bg-bg-base p-3">
        <div className="text-[10px] font-medium uppercase text-text-muted">Catalyst</div>
        <div className="mt-1 text-sm font-semibold text-text-primary">{catalyst?.title ?? 'No catalyst selected'}</div>
      </div>
      {mechanisms.map((mechanism) => {
        const rows = impacts.filter((impact) => impact.mechanismId === mechanism.id)
        if (rows.length === 0) return null
        return (
          <div key={mechanism.id} className="rounded-md border border-border-muted p-3">
            <div className="text-sm font-semibold text-text-primary">{mechanism.title}</div>
            <div className="mt-2 grid gap-2">
              {rows.map((impact) => {
                const group = groupsById.get(impact.groupId)
                return (
                  <button
                    key={impact.id}
                    onClick={() => onLockImpact(impact.id)}
                    className={`rounded-md border px-3 py-2 text-left text-xs ${impact.id === activeImpactId ? 'border-accent bg-accent/10' : 'border-border-muted bg-bg-base'}`}
                  >
                    <span className={`font-medium ${impactText(impact.direction)}`}>
                      {formatRelationshipLabel(impact.direction)}
                    </span>
                    <span className="ml-2 text-text-primary">{group?.name ?? 'Unknown group'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

function ImpactDetails({
  catalyst,
  impact,
  mechanism,
  group,
  locked,
  onClearLock,
}: {
  catalyst?: RelationshipCatalyst
  impact?: RelationshipImpact
  mechanism?: RelationshipMechanism
  group?: RelationshipGroup
  locked: boolean
  onClearLock: () => void
}) {
  return (
    <aside className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase text-text-muted">{impact ? 'Impact Detail' : 'Selected Catalyst'}</div>
          <h2 className="mt-1 font-heading text-base font-semibold text-text-primary">
            {impact ? group?.name ?? 'Unknown group' : catalyst?.title ?? 'No catalyst selected'}
          </h2>
        </div>
        {locked && (
          <button onClick={onClearLock} className="rounded-md border border-border-muted px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary">
            Show all
          </button>
        )}
      </div>
      {impact ? (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <StatusPill label={formatRelationshipLabel(impact.direction)} tone={impactTone(impact.direction)} />
            {impact.timeframe && <StatusPill label={formatRelationshipLabel(impact.timeframe)} tone="neutral" />}
            <span className="font-mono text-text-primary">{formatStrength(impact.strengthScore)}</span>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase text-text-muted">Mechanism</div>
            <div className="mt-1 text-text-primary">{mechanism?.title ?? '-'}</div>
            {mechanism?.description && <div className="mt-1 text-text-muted">{mechanism.description}</div>}
          </div>
          {impact.notes && <div className="text-text-secondary">{impact.notes}</div>}
          <TickerExamples examples={impact.tickerExamples} />
          <EvidenceDetails evidence={impact.evidence} />
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-xs text-text-secondary">
          <div className="flex flex-wrap gap-1.5">
            {catalyst && <StatusPill label={formatRelationshipLabel(catalyst.kind)} tone="neutral" />}
            {catalyst?.eventCategory && <StatusPill label={formatRelationshipLabel(catalyst.eventCategory)} tone="warn" />}
          </div>
          <div>{catalyst ? 'Hover a group to see ticker examples and evidence.' : 'No catalyst chain matches the current filters.'}</div>
        </div>
      )}
    </aside>
  )
}

function ImpactTable({
  impacts,
  allCount,
  groupsById,
  mechanismsById,
  locked,
  activeImpactId,
  onHoverImpact,
  onLockImpact,
  onClearLock,
}: {
  impacts: RelationshipImpact[]
  allCount: number
  groupsById: Map<string, RelationshipGroup>
  mechanismsById: Map<string, RelationshipMechanism>
  locked: boolean
  activeImpactId: string | null
  onHoverImpact: (impactId: string | null) => void
  onLockImpact: (impactId: string) => void
  onClearLock: () => void
}) {
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold text-text-primary">Catalyst Impact Table</h2>
        {locked && (
          <button onClick={onClearLock} className="rounded-md border border-border-muted px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary">
            Showing 1 of {allCount}
          </button>
        )}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="text-text-muted">
            <tr className="border-b border-border-muted">
              <th className="py-2 pr-3 font-medium">Mechanism</th>
              <th className="py-2 pr-3 font-medium">Theme / Group</th>
              <th className="py-2 pr-3 font-medium">Impact</th>
              <th className="py-2 pr-3 font-medium">Strength</th>
              <th className="py-2 pr-3 font-medium">Timeframe</th>
              <th className="py-2 pr-3 font-medium">Ticker Examples</th>
              <th className="py-2 pr-3 font-medium">Why / Notes</th>
              <th className="py-2 pr-3 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {impacts.map((impact) => {
              const group = groupsById.get(impact.groupId)
              const mechanism = mechanismsById.get(impact.mechanismId)
              const active = impact.id === activeImpactId
              return (
                <tr
                  key={impact.id}
                  onMouseEnter={() => onHoverImpact(impact.id)}
                  onMouseLeave={() => onHoverImpact(null)}
                  onClick={() => onLockImpact(impact.id)}
                  className={`cursor-pointer border-b border-border-muted/50 align-top ${active ? 'bg-accent/10' : 'hover:bg-bg-base'}`}
                >
                  <td className="py-2 pr-3 text-text-primary">{mechanism?.title ?? '-'}</td>
                  <td className="py-2 pr-3">
                    <GroupName group={group} />
                  </td>
                  <td className="py-2 pr-3">
                    <StatusPill label={formatRelationshipLabel(impact.direction)} tone={impactTone(impact.direction)} />
                  </td>
                  <td className="py-2 pr-3 font-mono text-text-primary">{formatStrength(impact.strengthScore)}</td>
                  <td className="py-2 pr-3 text-text-secondary">{formatRelationshipLabel(impact.timeframe)}</td>
                  <td className="py-2 pr-3">
                    <TickerExamples examples={impact.tickerExamples} compact />
                  </td>
                  <td className="max-w-[260px] py-2 pr-3 text-text-secondary">{impact.notes ?? '-'}</td>
                  <td className="py-2 pr-3">
                    <EvidenceDetails evidence={impact.evidence} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {impacts.length === 0 && <div className="mt-3 text-xs text-text-muted">No catalyst impacts match the current filters.</div>}
    </section>
  )
}

function StockLayerTable({
  groupedStocks,
}: {
  groupedStocks: ReturnType<typeof groupAffectedStocksByLayer>
}) {
  return (
    <section className="rounded-lg border border-border-default bg-bg-surface p-4">
      <h2 className="font-heading text-sm font-semibold text-text-primary">Affected Stocks By Layer</h2>
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {groupedStocks.length === 0 && <div className="mt-3 text-xs text-text-muted">No affected stocks match the current filters.</div>}
    </section>
  )
}

function TickerExamples({ examples, compact }: { examples: RelationshipImpact['tickerExamples']; compact?: boolean }) {
  if (examples.length === 0) return <span className="text-xs text-text-muted">No linked tickers</span>
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? 'max-w-[260px]' : ''}`}>
      {examples.map((stock) => (
        <span
          key={stock.id}
          className="rounded-md border border-border-muted px-2 py-0.5 text-[11px] text-text-secondary"
          title={`${stock.name}${stock.role ? ` / ${stock.role}` : ''}`}
        >
          <span className="font-mono text-text-primary">{stock.ticker}</span>
          {!compact && stock.role && <span className="ml-1 text-text-muted">{stock.role}</span>}
        </span>
      ))}
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
        {sources.map((source, index) =>
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
          ),
        )}
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
        {filtered ? 'No catalyst chain matches the current filters.' : 'No catalyst impact data has been imported yet.'}
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

function impactTone(direction: RelationshipImpact['direction']): 'bull' | 'bear' | 'warn' {
  if (direction === 'BENEFITS') return 'bull'
  if (direction === 'HARMS') return 'bear'
  return 'warn'
}

function impactText(direction: RelationshipImpact['direction']): string {
  if (direction === 'BENEFITS') return 'text-bullish'
  if (direction === 'HARMS') return 'text-bearish'
  return 'text-warning'
}

function edgeTone(direction?: RelationshipImpact['direction']): string {
  if (direction === 'BENEFITS') return 'text-bullish'
  if (direction === 'HARMS') return 'text-bearish'
  if (direction === 'MIXED') return 'text-warning'
  return 'text-border-default'
}

function nodeFill(node: { kind: string; direction?: RelationshipImpact['direction'] }): string {
  if (node.kind === 'CATALYST') return 'fill-accent/15'
  if (node.kind === 'MECHANISM') return 'fill-bg-surface'
  if (node.direction === 'BENEFITS') return 'fill-bullish/10'
  if (node.direction === 'HARMS') return 'fill-bearish/10'
  return 'fill-warning-muted'
}

function nodeWidth(node: { kind: string }): number {
  if (node.kind === 'CATALYST') return 22
  if (node.kind === 'MECHANISM') return 24
  return 23
}

function formatStrength(value: string | null) {
  const numeric = value == null ? null : Number(value)
  return Number.isFinite(numeric) && numeric != null ? `${Math.round(numeric * 100)}%` : '-'
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}
