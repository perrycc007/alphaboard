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
              importanceScore: new Prisma.Decimal(0.95),
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
    themeStocks: [
      {
        stock: {
          id: 'stock-fcx',
          ticker: 'FCX',
          name: 'Freeport-McMoRan',
          sector: 'Materials',
          industry: 'Copper Mining',
          metadataEvidenceJson: null,
          themeMemberships: [
            {
              themeId: rawTheme.id,
              groupId: 'group-copper',
              roleDescription: 'copper producer',
              importanceScore: new Prisma.Decimal(0.9),
              evidenceJson: null,
            },
          ],
        },
      },
    ],
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

const mechanisms = [
  {
    id: 'mech-compute',
    catalystId: 'cat-1',
    title: 'AI compute demand expands',
    description: 'Accelerator demand pulls capacity through the chain.',
    sortOrder: 0,
    evidenceJson: { sourceKeys: ['AI1'] },
    impacts: [
      {
        id: 'impact-chips',
        mechanismId: 'mech-compute',
        groupId: 'group-chips',
        direction: 'BENEFITS',
        relationshipType: 'BENEFITS',
        strengthScore: new Prisma.Decimal(0.95),
        timeframe: 'IMMEDIATE',
        notes: 'AI accelerator demand is first order.',
        evidenceJson: { sourceKeys: ['AI1'] },
        group: groups[0],
      },
      {
        id: 'impact-copper',
        mechanismId: 'mech-compute',
        groupId: 'group-copper',
        direction: 'BENEFITS',
        relationshipType: 'BENEFITS',
        strengthScore: new Prisma.Decimal(0.72),
        timeframe: 'MEDIUM_TERM',
        notes: 'Power infrastructure pulls copper demand.',
        evidenceJson: {
          sourceKeys: ['RAW1'],
          sources: [{ title: 'Freeport', url: 'https://example.com/fcx' }],
        },
        group: groups[1],
      },
    ],
  },
] as any[];

const catalysts = [
  {
    id: 'cat-1',
    title: 'AI capex and data-center buildout',
    themeId: theme.id,
    groupId: 'group-chips',
    kind: 'CURRENT',
    eventCategory: 'TECH_CYCLE',
    observedStartDate: null,
    observedEndDate: null,
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
    mechanisms,
    createdAt: new Date('2026-06-01T00:00:00Z'),
  },
  {
    id: 'cat-2',
    title: 'Historical copper squeeze',
    themeId: rawTheme.id,
    groupId: 'group-copper',
    kind: 'HISTORICAL',
    eventCategory: 'SUPPLY_CHAIN_CAPACITY',
    observedStartDate: new Date('2021-01-01T00:00:00Z'),
    observedEndDate: null,
    hypothesis: 'Historical copper supply constraint.',
    status: 'WATCHING',
    confidenceScore: new Prisma.Decimal(0.61),
    expectedBeneficiariesJson: ['FCX'],
    expectedLosersJson: [],
    evidenceJson: null,
    sourceUrlsJson: null,
    theme: rawTheme,
    group: { id: 'group-copper', name: 'Copper', themeId: rawTheme.id },
    mechanisms: [],
    createdAt: new Date('2026-05-01T00:00:00Z'),
  },
] as any[];

describe('RelationshipGraphService', () => {
  it('returns selected catalyst chain with mechanisms, impacts, and ticker examples', async () => {
    const { prisma, service } = createService();
    prisma.supplyChainGroup.findMany.mockResolvedValue(groups);
    prisma.groupRelationship.findMany.mockResolvedValue(edges);
    prisma.catalystHypothesis.findMany.mockResolvedValue(catalysts);

    const graph = await service.getGraph();

    expect(graph.selectedCatalystId).toBe('cat-1');
    expect(graph.groups.map((group) => group.id).sort()).toEqual([
      'group-chips',
      'group-copper',
    ]);
    expect(graph.mechanisms).toEqual([
      expect.objectContaining({
        id: 'mech-compute',
        title: 'AI compute demand expands',
      }),
    ]);
    expect(graph.impacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'impact-copper',
          catalystId: 'cat-1',
          direction: 'BENEFITS',
          strengthScore: '0.72',
          tickerExamples: [
            {
              id: 'stock-fcx',
              ticker: 'FCX',
              name: 'Freeport-McMoRan',
              role: 'copper producer',
            },
          ],
        }),
      ]),
    );
    expect(graph.stocks.map((stock) => stock.ticker).sort()).toEqual(['FCX', 'NVDA']);
  });

  it('filters by catalyst id, kind, event category, relationship type, and text search', async () => {
    const { prisma, service } = createService();
    prisma.supplyChainGroup.findMany.mockResolvedValue(groups);
    prisma.groupRelationship.findMany.mockResolvedValue(edges);
    prisma.catalystHypothesis.findMany.mockResolvedValue(catalysts);

    const graph = await service.getGraph({
      catalystId: 'cat-1',
      kind: 'CURRENT',
      eventCategory: 'TECH_CYCLE',
      relationshipType: 'BENEFITS',
      q: 'copper',
    } as any);

    expect(graph.selectedCatalystId).toBe('cat-1');
    expect(graph.impacts.map((impact) => impact.id)).toEqual(['impact-copper']);
    expect(graph.groups.map((group) => group.id)).toEqual(['group-copper']);
    expect(graph.catalysts.map((catalyst) => catalyst.id)).toEqual(['cat-1']);
  });

  it('falls back to historical catalysts when no current catalyst has impacts', async () => {
    const { prisma, service } = createService();
    prisma.supplyChainGroup.findMany.mockResolvedValue(groups);
    prisma.groupRelationship.findMany.mockResolvedValue([]);
    prisma.catalystHypothesis.findMany.mockResolvedValue([
      { ...catalysts[0], mechanisms: [] },
      { ...catalysts[1], mechanisms },
    ]);

    const graph = await service.getGraph();

    expect(graph.selectedCatalystId).toBe('cat-2');
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
