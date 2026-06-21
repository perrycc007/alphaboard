import { describe, expect, it } from 'vitest'
import { buildRelationshipGraphQuery, type RelationshipGraph } from '@/lib/api/research'
import {
  buildGraphNodes,
  catalystNamesForGroup,
  evidenceSourceCount,
  graphFacets,
  groupStocksByLayer,
} from './relationship-graph.selectors'

const graph: RelationshipGraph = {
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
      status: 'WATCHING',
      confidenceScore: '0.78',
      beneficiaries: ['NVDA'],
      losers: [],
      evidence: { sourceKeys: ['AI1'], sources: [], raw: {} },
    },
  ],
}

describe('relationship graph selectors', () => {
  it('builds stable query params', () => {
    expect(
      buildRelationshipGraphQuery({
        theme: 'AI',
        layer: 'COMPONENT',
        eventCategory: 'TECH_CYCLE',
        relationshipType: 'BENEFITS',
        q: 'NVDA',
      }),
    ).toBe('theme=AI&layer=COMPONENT&eventCategory=TECH_CYCLE&relationshipType=BENEFITS&q=NVDA')
  })

  it('counts evidence sources without double counting duplicate keys', () => {
    expect(evidenceSourceCount(graph.groups[0].evidence)).toBe(1)
    expect(evidenceSourceCount(graph.stocks[0].evidence)).toBe(2)
  })

  it('groups stocks by supply-chain layer and builds graph nodes', () => {
    const grouped = groupStocksByLayer(graph)
    expect(grouped.map((row) => row.layer)).toEqual(['EQUIPMENT', 'COMPONENT'])
    expect(grouped[1].groups[0].stocks[0].ticker).toBe('NVDA')

    const nodes = buildGraphNodes(graph.groups)
    expect(nodes.map((node) => node.id)).toEqual(['g-input', 'g-chip'])
    expect(nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true)
  })

  it('extracts facets and catalyst names', () => {
    expect(graphFacets(graph)).toEqual({
      themes: ['AI Infrastructure'],
      layers: ['EQUIPMENT', 'COMPONENT'],
      relationshipTypes: ['SUPPLIER_TO'],
      eventCategories: ['TECH_CYCLE'],
    })
    expect(catalystNamesForGroup(graph.catalysts, 'g-chip')).toEqual(['AI capex'])
  })
})
