import { Prisma } from '@prisma/client';
import {
  RelationshipGraphService,
  normalizeEvidence,
} from './relationship-graph.service';

function createService() {
  const prisma = {
    supplyChainGroup: { findMany: jest.fn() },
    groupRelationship: { findMany: jest.fn() },
    catalystHypothesis: { findMany: jest.fn() },
  };
  return {
    prisma,
    service: new RelationshipGraphService(prisma as any),
  };
}

const theme = {
  id: 'theme-ai',
  name: 'AI Infrastructure 2023',
  description: 'AI supply chain',
};
const rawTheme = {
  id: 'theme-raw',
  name: 'Strategic Raw Materials',
  description: 'Materials',
};

const groups = [
  {
    id: 'group-chips',
    themeId: theme.id,
    name: 'AI Chips',
    sortOrder: 1,
    layer: 'COMPONENT',
    evidenceJson: {
      sourceKeys: ['AI1'],
      sources: [{ key: 'AI1', title: 'NVIDIA', url: 'https://example.com/nvda' }],
    },
    theme,
    themeStocks: [
      {
        stock: {
          id: 'stock-nvda',
          ticker: 'NVDA',
          name: 'NVIDIA Corp',
          sector: 'Technology',
          industry: 'Semiconductors',
          metadataEvidenceJson: null,
          themeMemberships: [
            {
              themeId: theme.id,
              groupId: 'group-chips',
              roleDescription: 'AI GPU platform leader',
              evidenceJson: {
                sourceKeys: ['AI1'],
                sources: [{ title: 'NVIDIA', url: 'https://example.com/nvda' }],
              },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'group-copper',
    themeId: rawTheme.id,
    name: 'Copper',
    sortOrder: 1,
    layer: 'INPUT',
    evidenceJson: null,
    theme: rawTheme,
    themeStocks: [],
  },
  {
    id: 'group-old',
    themeId: theme.id,
    name: 'Legacy Group',
    sortOrder: 99,
    layer: null,
    evidenceJson: null,
    theme,
    themeStocks: [],
  },
] as any[];

const edges = [
  {
    id: 'edge-1',
    sourceGroupId: 'group-chips',
    targetGroupId: 'group-copper',
    relationshipType: 'BENEFITS',
    macroSensitivity: 'COPPER',
    eventCategory: 'TECH_CYCLE',
    strengthScore: new Prisma.Decimal(0.7),
    lagDaysEstimate: null,
    notes: 'AI power buildout pulls copper demand.',
    evidenceJson: {
      sourceKeys: ['RAW1'],
      sources: [{ title: 'Freeport', url: 'https://example.com/fcx' }],
    },
    sourceGroup: { ...groups[0], theme },
    targetGroup: { ...groups[1], theme: rawTheme },
  },
] as any[];

const catalysts = [
  {
    id: 'cat-1',
    title: 'AI capex and data-center buildout',
    themeId: theme.id,
    groupId: 'group-chips',
    hypothesis: 'AI capex supports the infrastructure chain.',
    status: 'WATCHING',
    confidenceScore: new Prisma.Decimal(0.78),
    expectedBeneficiariesJson: ['NVDA', 'FCX'],
    expectedLosersJson: [],
    evidenceJson: {
      sourceKeys: ['AI1'],
      sources: [{ title: 'NVIDIA', url: 'https://example.com/nvda' }],
    },
    sourceUrlsJson: null,
    theme,
    group: { id: 'group-chips', name: 'AI Chips', themeId: theme.id },
  },
] as any[];

describe('RelationshipGraphService', () => {
  it('returns graph rows with normalized evidence and null-layer groups', async () => {
    const { prisma, service } = createService();
    prisma.supplyChainGroup.findMany.mockResolvedValue(groups);
    prisma.groupRelationship.findMany.mockResolvedValue(edges);
    prisma.catalystHypothesis.findMany.mockResolvedValue(catalysts);

    const graph = await service.getGraph();

    expect(graph.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'group-old', layer: null }),
        expect.objectContaining({ id: 'group-chips', layer: 'COMPONENT' }),
      ]),
    );
    expect(graph.stocks[0]).toEqual(
      expect.objectContaining({
        ticker: 'NVDA',
        role: 'AI GPU platform leader',
        groupIds: ['group-chips'],
        evidence: expect.objectContaining({ sourceKeys: ['AI1'] }),
      }),
    );
    expect(graph.edges[0]).toEqual(
      expect.objectContaining({
        relationshipType: 'BENEFITS',
        eventCategory: 'TECH_CYCLE',
        macroSensitivity: 'COPPER',
        strengthScore: '0.7',
      }),
    );
    expect(graph.catalysts[0]).toEqual(
      expect.objectContaining({
        title: 'AI capex and data-center buildout',
        beneficiaries: ['NVDA', 'FCX'],
      }),
    );
  });

  it('filters by event category, relationship type, and text search', async () => {
    const { prisma, service } = createService();
    prisma.supplyChainGroup.findMany.mockResolvedValue(groups);
    prisma.groupRelationship.findMany.mockResolvedValue(edges);
    prisma.catalystHypothesis.findMany.mockResolvedValue(catalysts);

    const graph = await service.getGraph({
      layer: 'COMPONENT',
      eventCategory: 'TECH_CYCLE',
      relationshipType: 'BENEFITS',
      q: 'copper',
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.groups.map((group) => group.id).sort()).toEqual([
      'group-chips',
      'group-copper',
    ]);
    expect(graph.stocks.map((stock) => stock.ticker)).toEqual(['NVDA']);
  });
});

describe('normalizeEvidence', () => {
  it('normalizes JSON object and legacy URL-array evidence', () => {
    expect(
      normalizeEvidence({
        sourceKeys: ['A'],
        sources: [{ key: 'A', title: 'Source', url: 'https://example.com' }],
      }),
    ).toMatchObject({
      sourceKeys: ['A'],
      sources: [{ key: 'A', title: 'Source', url: 'https://example.com' }],
    });

    expect(normalizeEvidence(['https://example.com'])).toEqual({
      sourceKeys: [],
      sources: [{ url: 'https://example.com' }],
      raw: ['https://example.com'],
    });
  });
});
