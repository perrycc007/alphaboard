import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelReviewService } from './model/model-review.service';

export type OpportunityEventCategory =
  | 'RATES_LIQUIDITY'
  | 'INFLATION_COST'
  | 'TECH_CYCLE'
  | 'SUPPLY_CHAIN_CAPACITY'
  | 'GEOPOLITICS_WAR'
  | 'POLICY_REGULATION';

export interface NewsItemInput {
  headline: string;
  summary?: string;
  sourceUrl?: string;
  publishedAt?: string;
}

export interface OpportunityHypothesisInput {
  newsItems?: NewsItemInput[];
  marketEnvironment?: string;
  eventCategory?: OpportunityEventCategory;
  seedThemes?: string[];
  seedTickers?: string[];
}

export interface OpportunityHypothesis {
  title: string;
  eventCategory: OpportunityEventCategory;
  marketEnvironment: string;
  affectedThemes: string[];
  relatedEtfs: string[];
  possibleBeneficiaries: string[];
  possibleLosers: string[];
  historicalAnalogues: string[];
  evidenceSummary: string;
  technicalConfirmationNeeded: string[];
  confidenceScore: number;
  newsSearchPlan: string[];
  sectorSearchPlan: string[];
}

interface OpportunityPlaybookEntry {
  titlePrefix: string;
  searchPlan: string[];
  sectorSearchPlan: string[];
  affectedThemes: string[];
  relatedEtfs: string[];
  possibleBeneficiaries: string[];
  possibleLosers: string[];
  historicalAnalogues: string[];
  technicalConfirmationNeeded: string[];
  evidenceSummary: string;
  baseConfidence: number;
}

const PLAYBOOK: Record<OpportunityEventCategory, OpportunityPlaybookEntry> = {
  RATES_LIQUIDITY: {
    titlePrefix: 'Rates and liquidity shift',
    searchPlan: [
      'Fed rate path, dot plot, Powell comments, CPI/PCE trend, Treasury yields',
      'credit spreads, bank lending standards, dollar liquidity, liquidity facilities',
      'market reaction in QQQ, IWM, TLT, GLD, XLF, KRE, homebuilders',
    ],
    sectorSearchPlan: [
      'growth duration assets, semiconductors, software, homebuilders, banks, gold',
      'liquidity-sensitive speculative leaders and small caps',
    ],
    affectedThemes: ['Growth duration', 'Banks', 'Housing', 'Gold', 'Small caps'],
    relatedEtfs: ['QQQ', 'IWM', 'TLT', 'XLF', 'KRE', 'XHB', 'GLD'],
    possibleBeneficiaries: ['NVDA', 'MSFT', 'AMD', 'LEN', 'DHI', 'GLD'],
    possibleLosers: ['KRE when cuts imply credit stress', 'XLF when net interest margin compresses'],
    historicalAnalogues: [
      '2004-2006: tech could still lead during hikes when earnings growth offset discount-rate pressure',
      '2020-2021: liquidity expansion favored growth, crypto, IPOs, and high-beta leaders',
      '2022: rapid rate hikes pressured long-duration growth and speculative assets',
    ],
    technicalConfirmationNeeded: [
      'QQQ and leader breadth improving',
      'growth leaders reclaiming 20/50MA with volume',
      'banks confirming or diverging depending on credit-stress interpretation',
    ],
    evidenceSummary:
      'Rates change valuation and risk appetite, but price action must show whether the market reads the move as liquidity support or credit stress.',
    baseConfidence: 0.68,
  },
  INFLATION_COST: {
    titlePrefix: 'Inflation and cost cycle',
    searchPlan: [
      'CPI, PPI, PCE, wage growth, oil, freight, food, metal, and rent trends',
      'company margin commentary and pricing-power evidence',
      'commodity producer, retailer, airline, and transport reactions',
    ],
    sectorSearchPlan: [
      'energy, materials, agriculture, gold miners, retailers, airlines, restaurants',
      'companies with pricing power versus companies absorbing cost pressure',
    ],
    affectedThemes: ['Energy', 'Materials', 'Agriculture', 'Retail margin', 'Transport cost'],
    relatedEtfs: ['XLE', 'XOP', 'XME', 'GDX', 'XRT', 'JETS', 'DBA'],
    possibleBeneficiaries: ['XOM', 'CVX', 'FCX', 'NEM', 'MOS'],
    possibleLosers: ['AAL', 'DAL', 'XRT names without pricing power'],
    historicalAnalogues: [
      '1970s: commodity producers benefited while margin-sensitive businesses struggled',
      '2021-2022: energy and materials led as inflation surprised upward',
      'Post-pandemic freight spikes: logistics winners faded when capacity normalized',
    ],
    technicalConfirmationNeeded: [
      'commodity ETFs breaking out or holding pullbacks',
      'margin-sensitive groups failing at resistance',
      'relative strength in producers versus consumers',
    ],
    evidenceSummary:
      'Inflation creates winners and losers; the key test is whether demand stays strong and companies can pass through costs.',
    baseConfidence: 0.66,
  },
  TECH_CYCLE: {
    titlePrefix: 'Technology cycle shift',
    searchPlan: [
      'AI capex, semiconductor orders, cloud capex, inventory cycle, PC/smartphone cycle',
      'supplier commentary from chipmakers, foundries, equipment, networking, and power/cooling',
      'ETF and leader reactions in SMH, SOXX, IGV, CLOU, SKYY',
    ],
    sectorSearchPlan: [
      'semiconductors, semiconductor equipment, networking, power, cooling, data centers, software second-order demand',
    ],
    affectedThemes: ['AI infrastructure', 'Semiconductors', 'Networking', 'Power and cooling', 'Data centers'],
    relatedEtfs: ['SMH', 'SOXX', 'IGV', 'SKYY', 'XLK', 'DTCR'],
    possibleBeneficiaries: ['NVDA', 'AMD', 'AVGO', 'TSM', 'ANET', 'VRT', 'ETN'],
    possibleLosers: ['AI application names without revenue leverage', 'hardware names with excess inventory'],
    historicalAnalogues: [
      '1995-2000 internet buildout: infrastructure and networking led before many applications monetized',
      '2016-2018 cloud and GPU cycle: semiconductors led software demand expectations',
      '2023-2024 AI capex: semiconductors, networking, power, and cooling were stronger than many app-layer names',
    ],
    technicalConfirmationNeeded: [
      'SMH/SOXX in Stage 2 or constructive pullback',
      'supplier groups moving together',
      'software confirming only after infrastructure leadership broadens',
    ],
    evidenceSummary:
      'Tech themes work best when the revenue capture point is identified in the supply chain, not when every company uses the buzzword.',
    baseConfidence: 0.72,
  },
  SUPPLY_CHAIN_CAPACITY: {
    titlePrefix: 'Supply chain and capacity shock',
    searchPlan: [
      'shortage, glut, inventory, capacity additions, shipping rates, port congestion, factory outages',
      'upstream supplier pricing, downstream margin impact, and substitute beneficiaries',
      'group reactions in transport, industrials, commodities, and affected end markets',
    ],
    sectorSearchPlan: [
      'upstream suppliers, bottleneck owners, logistics providers, equipment suppliers, downstream users',
    ],
    affectedThemes: ['Supply bottleneck', 'Capacity glut', 'Logistics', 'Industrial equipment'],
    relatedEtfs: ['IYT', 'XLI', 'XME', 'SEA', 'SMH'],
    possibleBeneficiaries: ['bottleneck suppliers', 'logistics providers during shortage', 'low-cost producers'],
    possibleLosers: ['downstream margin absorbers', 'high-cost producers during glut'],
    historicalAnalogues: [
      '2020-2021 shipping and port congestion: freight and logistics beneficiaries surged before normalizing',
      '2021-2022 chip shortage: automakers and hardware users were constrained while scarce suppliers had pricing power',
      'Solar capacity gluts: strong demand still failed to protect margins when supply expanded too fast',
    ],
    technicalConfirmationNeeded: [
      'upstream group breadth improving',
      'downstream groups losing relative strength',
      'shipping or inventory-sensitive ETFs confirming the causal story',
    ],
    evidenceSummary:
      'Supply shocks change pricing power; capacity gluts reverse it even when demand looks healthy.',
    baseConfidence: 0.64,
  },
  GEOPOLITICS_WAR: {
    titlePrefix: 'Geopolitical risk shock',
    searchPlan: [
      'war, sanctions, export controls, chokepoints, defense budgets, energy-route disruptions',
      'commodity and defense ETF reaction, currency/yield stress, affected supply-chain relocation',
      'whether the event is acute fear or durable spending/capacity change',
    ],
    sectorSearchPlan: [
      'defense, energy, shipping, cybersecurity, commodities, reshoring beneficiaries',
    ],
    affectedThemes: ['Defense', 'Energy security', 'Cybersecurity', 'Reshoring', 'Commodity security'],
    relatedEtfs: ['ITA', 'PPA', 'XLE', 'XOP', 'CIBR', 'IYT'],
    possibleBeneficiaries: ['LMT', 'RTX', 'NOC', 'XOM', 'CVX', 'PANW'],
    possibleLosers: ['travel demand during acute shocks', 'supply-chain names exposed to disrupted regions'],
    historicalAnalogues: [
      'Russia-Ukraine 2022: energy, defense, and selected commodities benefited from supply and budget shifts',
      'Middle East oil shocks: crude-sensitive groups can rally while airlines and consumers face cost pressure',
      'Export controls on China semis: reshoring and domestic equipment chains can benefit while exposed suppliers derisk',
    ],
    technicalConfirmationNeeded: [
      'defense/energy/cyber groups confirming together',
      'affected losers breaking support or failing rebounds',
      'commodity move sustained beyond first fear spike',
    ],
    evidenceSummary:
      'Geopolitics matters most when it changes resource access, supply routes, budgets, or regulation beyond the first headline.',
    baseConfidence: 0.62,
  },
  POLICY_REGULATION: {
    titlePrefix: 'Policy and regulation shift',
    searchPlan: [
      'new law, subsidy, tax credit, ban, antitrust action, FDA/SEC/FTC/regulator decisions',
      'which companies receive subsidy, lose economics, or face compliance burden',
      'policy durability and whether related groups are confirming technically',
    ],
    sectorSearchPlan: [
      'direct subsidy recipients, regulated losers, suppliers to beneficiaries, compliance vendors',
    ],
    affectedThemes: ['Subsidy beneficiaries', 'Regulated platforms', 'Compliance', 'Industrial policy'],
    relatedEtfs: ['SMH', 'ICLN', 'TAN', 'XBI', 'KWEB', 'XLI'],
    possibleBeneficiaries: ['domestic manufacturers', 'policy-backed infrastructure suppliers'],
    possibleLosers: ['regulated platforms', 'subsidy losers', 'businesses facing price controls'],
    historicalAnalogues: [
      'CHIPS Act: semiconductors and domestic capacity beneficiaries gained a policy tailwind',
      'China education and internet regulation 2021: policy destroyed prior economics despite low valuations',
      'IRA clean-energy subsidies: policy support helped selected renewables, but technical confirmation varied by cycle',
    ],
    technicalConfirmationNeeded: [
      'direct beneficiaries showing relative strength',
      'policy losers failing to reclaim broken support',
      'supplier groups confirming the second-order thesis',
    ],
    evidenceSummary:
      'Policy can create or destroy an industry, but the market must confirm which part of the value chain captures the benefit.',
    baseConfidence: 0.65,
  },
};

const CATEGORY_KEYWORDS: Array<{
  category: OpportunityEventCategory;
  keywords: string[];
}> = [
  {
    category: 'RATES_LIQUIDITY',
    keywords: ['fed', 'rate', 'cut', 'hike', 'yield', 'treasury', 'liquidity', 'qe', 'qt', 'credit'],
  },
  {
    category: 'INFLATION_COST',
    keywords: ['inflation', 'cpi', 'ppi', 'pce', 'oil', 'gas', 'wage', 'freight', 'cost', 'commodity'],
  },
  {
    category: 'TECH_CYCLE',
    keywords: ['ai', 'semiconductor', 'chip', 'gpu', 'cloud', 'server', 'inventory', 'smartphone', 'pc'],
  },
  {
    category: 'SUPPLY_CHAIN_CAPACITY',
    keywords: ['shortage', 'capacity', 'supply chain', 'inventory', 'port', 'shipping', 'factory', 'glut'],
  },
  {
    category: 'GEOPOLITICS_WAR',
    keywords: ['war', 'sanction', 'export control', 'tariff', 'conflict', 'defense', 'missile', 'taiwan'],
  },
  {
    category: 'POLICY_REGULATION',
    keywords: ['policy', 'regulation', 'subsidy', 'ban', 'antitrust', 'fda', 'sec', 'ftc', 'chips act'],
  },
];

export function classifyEventCategory(text: string): OpportunityEventCategory {
  const lower = text.toLowerCase();
  let best: { category: OpportunityEventCategory; score: number } = {
    category: 'TECH_CYCLE',
    score: 0,
  };

  for (const candidate of CATEGORY_KEYWORDS) {
    const score = candidate.keywords.reduce(
      (sum, keyword) => sum + (lower.includes(keyword) ? 1 : 0),
      0,
    );
    if (score > best.score) best = { category: candidate.category, score };
  }
  return best.category;
}

export function getOpportunityPlaybook(
  category: OpportunityEventCategory,
): OpportunityPlaybookEntry {
  return PLAYBOOK[category];
}

@Injectable()
export class OpportunityHypothesisService {
  private readonly logger = new Logger(OpportunityHypothesisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelReview: ModelReviewService,
  ) {}

  async formHypothesis(
    input: OpportunityHypothesisInput = {},
  ): Promise<OpportunityHypothesis> {
    const newsText = this.newsText(input.newsItems);
    const category =
      input.eventCategory ??
      classifyEventCategory(`${newsText} ${input.marketEnvironment ?? ''}`);
    const playbook = PLAYBOOK[category];
    const relatedStocks = await this.findRelatedStocks(playbook, input.seedTickers);
    const modelResult = await this.tryModelEnrichment(input, category, playbook);

    const affectedThemes = this.unique([
      ...playbook.affectedThemes,
      ...(input.seedThemes ?? []),
      ...this.toStringArray(modelResult.affectedThemes),
    ]);
    const beneficiaries = this.unique([
      ...playbook.possibleBeneficiaries,
      ...relatedStocks.slice(0, 12),
      ...this.toStringArray(modelResult.possibleBeneficiaries),
    ]);

    return {
      title:
        this.stringOrUndefined(modelResult.title) ??
        this.buildTitle(playbook.titlePrefix, input.newsItems),
      eventCategory: category,
      marketEnvironment:
        input.marketEnvironment ?? 'Use latest market-condition snapshots before ranking exposure.',
      affectedThemes,
      relatedEtfs: this.unique([
        ...playbook.relatedEtfs,
        ...this.toStringArray(modelResult.relatedEtfs),
      ]),
      possibleBeneficiaries: beneficiaries,
      possibleLosers: this.unique([
        ...playbook.possibleLosers,
        ...this.toStringArray(modelResult.possibleLosers),
      ]),
      historicalAnalogues: this.unique([
        ...playbook.historicalAnalogues,
        ...this.toStringArray(modelResult.historicalAnalogues),
      ]),
      evidenceSummary:
        this.stringOrUndefined(modelResult.evidenceSummary) ??
        playbook.evidenceSummary,
      technicalConfirmationNeeded: this.unique([
        ...playbook.technicalConfirmationNeeded,
        ...this.toStringArray(modelResult.technicalConfirmationNeeded),
      ]),
      confidenceScore: this.clampConfidence(
        this.numberOrUndefined(modelResult.confidenceScore) ??
          playbook.baseConfidence,
      ),
      newsSearchPlan: playbook.searchPlan,
      sectorSearchPlan: playbook.sectorSearchPlan,
    };
  }

  private async tryModelEnrichment(
    input: OpportunityHypothesisInput,
    eventCategory: OpportunityEventCategory,
    playbook: OpportunityPlaybookEntry,
  ): Promise<Record<string, unknown>> {
    const review = await this.modelReview.review({
      reviewType: 'CATALYST_SEARCH',
      targetType: 'opportunity-hypothesis',
      targetId: eventCategory,
      prompt:
        'Form one US-stock opportunity hypothesis from the news and market environment. ' +
        'Use the supplied playbook as the historical evidence base. Return JSON keys: ' +
        'title, affectedThemes, relatedEtfs, possibleBeneficiaries, possibleLosers, ' +
        'historicalAnalogues, evidenceSummary, technicalConfirmationNeeded, confidenceScore. ' +
        'Do not give automatic trade instructions.',
      payload: { input, eventCategory, playbook },
    });

    if (!review.resultJson || typeof review.resultJson !== 'object') {
      return {};
    }
    return review.resultJson as Record<string, unknown>;
  }

  private async findRelatedStocks(
    playbook: OpportunityPlaybookEntry,
    seedTickers?: string[],
  ): Promise<string[]> {
    const terms = this.unique([
      ...playbook.affectedThemes,
      ...playbook.relatedEtfs,
      ...(seedTickers ?? []),
    ]).slice(0, 12);
    const where: Prisma.StockWhereInput[] = terms.flatMap((term) => [
      { ticker: { equals: term, mode: 'insensitive' } },
      { sector: { contains: term, mode: 'insensitive' } },
      { industry: { contains: term, mode: 'insensitive' } },
      { briefDescription: { contains: term, mode: 'insensitive' } },
    ]);

    if (where.length === 0) return [];
    try {
      const rows = await this.prisma.stock.findMany({
        where: { OR: where, isActive: true, isTradable: true },
        select: { ticker: true },
        take: 25,
        orderBy: { ticker: 'asc' },
      });
      return rows.map((row) => row.ticker);
    } catch (error) {
      this.logger.debug(`Related stock lookup skipped: ${String(error)}`);
      return [];
    }
  }

  private buildTitle(prefix: string, newsItems?: NewsItemInput[]): string {
    const headline = newsItems?.find((item) => item.headline)?.headline;
    return headline ? `${prefix}: ${headline}` : prefix;
  }

  private newsText(newsItems?: NewsItemInput[]): string {
    return (
      newsItems
        ?.map((item) => `${item.headline} ${item.summary ?? ''}`)
        .join(' ') ?? ''
    );
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private numberOrUndefined(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter((value) => value.trim()))];
  }

  private clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, Number(value.toFixed(2))));
  }
}
