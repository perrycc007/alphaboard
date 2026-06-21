import { describe, expect, it } from 'vitest'
import { buildRelationshipGraphQuery, type RelationshipGraph } from '@/lib/api/research'
import {
  buildCatalystChainLayout,
  evidenceSourceCount,
  graphFacets,
  groupAffectedStocksByLayer,
  sortImpactsForTable,
} from './relationship-graph.selectors'

const graph: RelationshipGraph = {
  selectedCatalystId: 'c-1',
  themes: [{ id: 'theme-ai', name: 'AI Infrastructure', description: null }],
  groups: [
    {
      id: 'g-input',
      themeId: 'theme-ai',
      themeName: 'AI Infrastructure',
      name: 'Semi Equipment',
      layer: 'EQUIPMENT',
      evidence: { sourceKeys: ['AI5'], sources: [{ key: 'AI5', url: 'https://example.com' }], raw: {} },
    },
    {
      id: 'g-chip',
      themeId: 'theme-ai',
      themeName: 'AI Infrastructure',
      name: 'AI Chips',
      layer: 'COMPONENT',
      evidence: { sourceKeys: ['AI1'], sources: [], raw: {} },
    },
  ],
  stocks: [
    {
      id: 's-nvda',
      ticker: 'NVDA',
      name: 'NVIDIA',
      sector: 'Technology',
      industry: 'Semiconductors',
      groupIds: ['g-chip'],
      role: 'AI GPU leader',
      evidence: { sourceKeys: ['AI1'], sources: [{ title: 'NVIDIA' }], raw: {} },
    },
  ],
  edges: [
    {
      id: 'e-1',
      sourceGroupId: 'g-input',
      targetGroupId: 'g-chip',
      relationshipType: 'SUPPLIER_TO',
      macroSensitivity: null,
      eventCategory: 'TECH_CYCLE',
      strengthScore: '0.9',
      lagDaysEstimate: null,
      notes: 'Tools feed chips',
      evidence: { sourceKeys: ['AI5'], sources: [{ title: 'ASML' }], raw: {} },
    },
  ],
  catalysts: [
    {
      id: 'c-1',
      title: 'AI capex',
      themeId: 'theme-ai',
      groupId: 'g-chip',
      kind: 'CURRENT',
      eventCategory: 'TECH_CYCLE',
      observedStartDate: null,
      observedEndDate: null,
      status: 'WATCHING',
      confidenceScore: '0.78',
      beneficiaries: ['NVDA'],
      losers: [],
      evidence: { sourceKeys: ['AI1'], sources: [], raw: {} },
    },
  ],
  mechanisms: [
    {
      id: 'm-1',
      catalystId: 'c-1',
      title: 'Compute demand expands',
      description: 'Accelerators pull capacity through the chain.',
      sortOrder: 0,
      evidence: { sourceKeys: ['AI1'], sources: [], raw: {} },
    },
  ],
  impacts: [
    {
      id: 'i-harm',
      catalystId: 'c-1',
      mechanismId: 'm-1',
      groupId: 'g-input',
      direction: 'HARMS',
      relationshipType: 'HURTS',
      strengthScore: '0.4',
      timeframe: 'SHORT_TERM',
      notes: 'Input cost pressure',
      evidence: { sourceKeys: ['AI5'], sources: [], raw: {} },
      tickerExamples: [],
    },
    {
      id: 'i-benefit',
      catalystId: 'c-1',
      mechanismId: 'm-1',
      groupId: 'g-chip',
      direction: 'BENEFITS',
      relationshipType: 'BENEFITS',
      strengthScore: '0.9',
      timeframe: 'IMMEDIATE',
      notes: 'Demand first order',
      evidence: { sourceKeys: ['AI1'], sources: [], raw: {} },
      tickerExamples: [
        {
          id: 's-nvda',
          ticker: 'NVDA',
          name: 'NVIDIA',
          role: 'AI GPU leader',
        },
      ],
    },
  ],
}

describe('relationship graph selectors', () => {
  it('builds stable query params with catalyst filters', () => {
    expect(
      buildRelationshipGraphQuery({
        catalystId: 'c-1',
        kind: 'CURRENT',
        theme: 'AI',
        layer: 'COMPONENT',
        eventCategory: 'TECH_CYCLE',
        relationshipType: 'BENEFITS',
        q: 'NVDA',
      }),
    ).toBe('catalystId=c-1&kind=CURRENT&theme=AI&layer=COMPONENT&eventCategory=TECH_CYCLE&relationshipType=BENEFITS&q=NVDA')
  })

  it('counts evidence sources without double counting duplicate keys', () => {
    expect(evidenceSourceCount(graph.groups[0].evidence)).toBe(1)
    expect(evidenceSourceCount(graph.stocks[0].evidence)).toBe(2)
  })

  it('sorts impact rows by direction and strength', () => {
    expect(sortImpactsForTable(graph.impacts).map((impact) => impact.id)).toEqual([
      'i-benefit',
      'i-harm',
    ])
  })

  it('builds deterministic catalyst chain nodes and affected stock rows', () => {
    const groupsById = new Map(graph.groups.map((group) => [group.id, group]))
    const layout = buildCatalystChainLayout(
      graph.catalysts[0],
      graph.mechanisms,
      graph.impacts,
      groupsById,
    )

    expect(layout.nodes.map((node) => node.kind)).toEqual([
      'CATALYST',
      'MECHANISM',
      'IMPACT',
      'IMPACT',
    ])
    expect(layout.edges).toHaveLength(3)

    const grouped = groupAffectedStocksByLayer(graph)
    expect(grouped.map((row) => row.layer)).toEqual(['EQUIPMENT', 'COMPONENT'])
    expect(grouped[1].groups[0].stocks[0].ticker).toBe('NVDA')
  })

  it('extracts catalyst-aware facets', () => {
    expect(graphFacets(graph)).toEqual({
      catalystKinds: ['CURRENT'],
      themes: ['AI Infrastructure'],
      layers: ['EQUIPMENT', 'COMPONENT'],
      relationshipTypes: ['SUPPLIER_TO'],
      eventCategories: ['TECH_CYCLE'],
    })
  })
})
