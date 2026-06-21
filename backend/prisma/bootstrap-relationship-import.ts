import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SupplyChainLayer =
  | 'INPUT'
  | 'EQUIPMENT'
  | 'COMPONENT'
  | 'INFRASTRUCTURE'
  | 'PLATFORM'
  | 'APPLICATION'
  | 'DISTRIBUTION'
  | 'END_MARKET'
  | 'FINANCING';

type RelationshipType =
  | 'LEADS'
  | 'LAGS'
  | 'BENEFITS'
  | 'HURTS'
  | 'COMPETES'
  | 'SUPPLIER_TO';

type MacroSensitivity =
  | 'RATES'
  | 'DOLLAR'
  | 'OIL'
  | 'COPPER'
  | 'GOLD'
  | 'YIELDS'
  | 'INFLATION';

type CatalystKind = 'CURRENT' | 'HISTORICAL' | 'PATTERN';
type CatalystImpactDirection = 'BENEFITS' | 'HARMS' | 'MIXED';
type CatalystImpactTimeframe =
  | 'IMMEDIATE'
  | 'SHORT_TERM'
  | 'MEDIUM_TERM'
  | 'LONG_TERM';

interface SourceRef {
  title: string;
  url: string;
}

interface ThemeSeed {
  name: string;
  description: string;
}

interface GroupSeed {
  theme: string;
  name: string;
  layer: SupplyChainLayer;
  tickers: string[];
  upstream: string[];
  downstream: string[];
  demandDriver: string;
  bottleneck: string;
  proxy: string;
  sourceKeys: string[];
}

interface StockSeed {
  ticker: string;
  description: string;
  sector: string;
  industry: string;
  group: string;
  theme: string;
  role: string;
  importance: number;
  sourceKeys: string[];
}

interface RelationshipSeed {
  sourceGroup: string;
  targetGroup: string;
  relationshipType: RelationshipType;
  eventCategory: string;
  macroSensitivity?: MacroSensitivity;
  strength: number;
  lagDays?: number;
  reason: string;
  sourceKeys: string[];
}

interface CatalystSeed {
  title: string;
  theme: string;
  group?: string;
  kind: CatalystKind;
  eventCategory: string;
  hypothesis: string;
  beneficiaries: string[];
  losers: string[];
  confirmation: string[];
  rejection: string[];
  confidence: number;
  sourceKeys: string[];
  mechanisms: CatalystMechanismSeed[];
}

interface CatalystMechanismSeed {
  title: string;
  description: string;
  sourceKeys: string[];
  impacts: CatalystImpactSeed[];
}

interface CatalystImpactSeed {
  theme: string;
  group: string;
  direction: CatalystImpactDirection;
  relationshipType?: RelationshipType;
  strength: number;
  timeframe: CatalystImpactTimeframe;
  notes: string;
  sourceKeys: string[];
}

const SOURCES: Record<string, SourceRef> = {
  AI1: { title: 'NVIDIA Investor Relations', url: 'https://investor.nvidia.com/home/default.aspx' },
  AI2: { title: 'AMD Investor Relations', url: 'https://ir.amd.com/' },
  AI3: {
    title: 'Broadcom AI semiconductor revenue update',
    url: 'https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-first-quarter-fiscal-year-2026-financial',
  },
  AI4: { title: 'TSMC Investor Relations', url: 'https://investor.tsmc.com/english' },
  AI5: { title: 'ASML Investors', url: 'https://www.asml.com/investors' },
  AI6: { title: 'Arista Investor Relations', url: 'https://investors.arista.com/Home/default.aspx' },
  AI7: { title: 'Supermicro Investor Relations', url: 'https://ir.supermicro.com/ir-overview/default.aspx' },
  AI8: { title: 'Dell AI Solutions', url: 'https://www.dell.com/en-us/shop/dell-ai-solutions/sc/artificial-intelligence' },
  AI9: { title: 'Vertiv Investor Relations', url: 'https://investors.vertiv.com/overview/default.aspx' },
  AI10: {
    title: 'Eaton Annual Report',
    url: 'https://www.eaton.com/us/en-us/company/investor-relations/investor-toolkit/financial-reports/annual-report.html',
  },
  AI11: { title: 'GE Vernova Investors', url: 'https://www.gevernova.com/investors' },
  AI12: { title: 'Constellation Energy Investors', url: 'https://investors.constellationenergy.com/' },
  AI13: {
    title: 'Celestica AI infrastructure',
    url: 'https://www.celestica.com/blog/article/ai-infrastructure-for-the-data-center-and-beyond',
  },
  AI14: { title: 'Flex Data Center', url: 'https://flex.com/industries/data-center' },
  AI15: { title: 'GlobalFoundries', url: 'https://gf.com/' },
  AI16: {
    title: 'Linde semiconductor gases',
    url: 'https://www.linde-engineering.com/news-and-events/press-releases/2021/linde-signs-long-term-agreement-to-supply-new-world-class-semiconductor-manufacturing-complex-in-the-u-s',
  },
  ETF1: { title: 'VanEck SMH', url: 'https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/' },
  DEF1: { title: 'Lockheed Martin', url: 'https://www.lockheedmartin.com/en-us/index.html' },
  DEF2: { title: 'RTX', url: 'https://www.rtx.com/who-we-are/we-are-rtx' },
  DEF3: { title: 'Booz Allen Hamilton', url: 'https://www.boozallen.com/' },
  DEF4: { title: 'Palantir Defense', url: 'https://www.palantir.com/offerings/defense/' },
  DEF5: {
    title: 'iShares U.S. Aerospace & Defense ETF',
    url: 'https://www.ishares.com/us/products/239502/ishares-us-aerospace-defense-etf',
  },
  AG1: { title: 'Deere Investor Relations', url: 'https://investor.deere.com/home/' },
  AG2: { title: 'Nutrien', url: 'https://www.nutrien.com/' },
  AG3: { title: 'Corteva', url: 'https://www.corteva.com/' },
  AG4: { title: 'ADM Investor Relations', url: 'https://www.investors.adm.com/' },
  ETF2: { title: 'VanEck MOO', url: 'https://www.vaneck.com/us/en/investments/agribusiness-etf-moo/' },
  RAW1: { title: 'Freeport-McMoRan', url: 'https://www.fcx.com/' },
  RAW2: { title: 'Alcoa Investor Relations', url: 'https://investors.alcoa.com/investor-overview/default.aspx' },
  RAW3: { title: 'Nucor Investor Relations', url: 'https://investors.nucor.com/overview/default.aspx' },
  RAW4: { title: 'Cleveland-Cliffs Investors', url: 'https://www.clevelandcliffs.com/investors' },
  ETF3: {
    title: 'SPDR S&P Metals and Mining ETF',
    url: 'https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-metals-mining-etf-xme',
  },
};

const THEMES: ThemeSeed[] = [
  {
    name: 'Agriculture Inputs & Processing',
    description: 'Fertilizer, crop protection, farm equipment, and ag processing value chain.',
  },
  {
    name: 'Strategic Raw Materials',
    description:
      'Copper, aluminum, steel, lithium, gas, LNG, and refining groups tied to AI, defense, agriculture, and infrastructure.',
  },
];

const GROUPS: GroupSeed[] = [
  group('AI Infrastructure 2023', 'Semi Equipment', 'EQUIPMENT', ['ASML', 'AMAT', 'LRCX', 'KLAC', 'TER'], [], ['Foundry/OSAT'], 'Advanced AI chip capacity', 'Tool lead times and export controls', 'SMH', ['AI5', 'ETF1']),
  group('AI Infrastructure 2023', 'Foundry/OSAT', 'COMPONENT', ['TSM', 'GFS', 'ASX'], ['Semi Equipment', 'Semiconductor Inputs'], ['AI Chips'], 'AI accelerator supply', 'Advanced-node and packaging capacity', 'SMH', ['AI4', 'AI15', 'ETF1']),
  group('AI Infrastructure 2023', 'Semiconductor Inputs', 'INPUT', ['LIN'], [], ['Foundry/OSAT'], 'Fab utilization and new fab ramps', 'High-purity gas supply', 'SMH', ['AI16']),
  group('AI Infrastructure 2023', 'AI Chips', 'COMPONENT', ['NVDA', 'AMD', 'AVGO'], ['Foundry/OSAT'], ['AI Servers', 'Networking', 'Defense IT/Cyber'], 'AI training and inference capex', 'HBM, packaging, power envelope', 'SMH', ['AI1', 'AI2', 'AI3']),
  group('AI Infrastructure 2023', 'AI Servers', 'INFRASTRUCTURE', ['SMCI', 'DELL', 'HPE', 'CLS', 'FLEX'], ['AI Chips', 'Networking', 'Cooling/Power'], ['Cloud and enterprise AI'], 'Cluster deployment', 'GPU supply and rack power density', 'SMH/XLK', ['AI7', 'AI8', 'AI13', 'AI14']),
  group('AI Infrastructure 2023', 'Networking', 'INFRASTRUCTURE', ['ANET', 'CSCO'], ['AI Chips'], ['AI Servers'], 'Scale-out AI clusters', 'High-speed Ethernet and optics', 'SMH/QQQ', ['AI6']),
  group('AI Power Nuclear 2024', 'Cooling/Power', 'INFRASTRUCTURE', ['VRT', 'ETN'], ['AI Servers', 'Copper'], ['Grid/Equipment', 'Power Generation'], 'High-density racks', 'Power delivery and thermal capacity', 'DTCR/XLU', ['AI9', 'AI10']),
  group('AI Power Nuclear 2024', 'Grid/Equipment', 'INFRASTRUCTURE', ['GEV'], ['Copper', 'Cooling/Power'], ['Power Generation', 'Utilities'], 'Data-center load growth', 'Interconnection and grid equipment lead times', 'XLU', ['AI11']),
  group('AI Power Nuclear 2024', 'Power Generation', 'INPUT', ['CEG'], ['Gas/LNG', 'Grid/Equipment'], ['Data centers', 'Utilities'], 'Clean baseload demand', 'Permitting and capacity additions', 'XLU', ['AI12']),
  group('Defense Aerospace 2025', 'Defense Primes', 'PLATFORM', ['LMT', 'NOC', 'GD', 'RTX', 'BA'], ['Steel', 'Aluminum', 'AI Chips'], ['Defense IT/Cyber'], 'Rearmament and geopolitics', 'Budget and procurement cycles', 'ITA', ['DEF1', 'DEF2', 'DEF5']),
  group('Defense Aerospace 2025', 'Defense IT/Cyber', 'APPLICATION', ['PLTR', 'BAH', 'LDOS', 'SAIC', 'CACI'], ['Cloud/data infrastructure', 'Defense Primes'], ['Public Safety AI'], 'Software-defined defense', 'Authority-to-operate and procurement timing', 'ITA/CIBR', ['DEF3', 'DEF4']),
  group('Defense Aerospace 2025', 'Public Safety AI', 'END_MARKET', ['AXON', 'PLTR'], ['Defense IT/Cyber'], [], 'Safety automation', 'Municipal budgets and privacy constraints', 'ITA', ['DEF3', 'DEF4']),
  group('Agriculture Inputs & Processing', 'Fertilizer', 'INPUT', ['NTR', 'MOS', 'CF', 'SQM'], ['Gas/LNG'], ['Crop Production', 'Ag Processing/Trading'], 'Crop economics and planted acreage', 'Gas costs and export policy', 'MOO', ['AG2', 'ETF2']),
  group('Agriculture Inputs & Processing', 'Seeds/Crop Protection', 'INPUT', ['CTVA', 'FMC'], [], ['Crop Production'], 'Yield protection', 'Regulation and resistance cycles', 'MOO', ['AG3', 'ETF2']),
  group('Agriculture Inputs & Processing', 'Farm Equipment', 'EQUIPMENT', ['DE', 'AGCO'], ['Steel', 'Electronics'], ['Growers'], 'Replacement and precision agriculture', 'Farmer income and rates', 'MOO', ['AG1', 'ETF2']),
  group('Agriculture Inputs & Processing', 'Ag Processing/Trading', 'DISTRIBUTION', ['ADM', 'BG'], ['Crop Production'], ['Food/feed/biofuels/export'], 'Food, feed, and biofuel demand', 'Crop spreads and logistics', 'MOO', ['AG4', 'ETF2']),
  group('Strategic Raw Materials', 'Copper', 'INPUT', ['FCX'], [], ['Grid/Equipment', 'Cooling/Power'], 'Grid and electrification demand', 'Ore grade and permitting', 'XME', ['RAW1', 'ETF3']),
  group('Strategic Raw Materials', 'Aluminum', 'INPUT', ['AA'], [], ['Defense Primes', 'Aerospace'], 'Aerospace, grid, packaging, transport', 'Electricity and tariffs', 'XME', ['RAW2', 'ETF3']),
  group('Strategic Raw Materials', 'Steel', 'COMPONENT', ['NUE', 'CLF'], ['Iron ore', 'Scrap', 'Energy'], ['Defense Primes', 'Farm Equipment'], 'Infrastructure, defense, autos, energy', 'Scrap and ore spreads', 'XME', ['RAW3', 'RAW4', 'ETF3']),
  group('Strategic Raw Materials', 'Lithium', 'INPUT', ['ALB', 'SQM'], [], ['Batteries', 'EV/storage'], 'Battery and storage demand', 'Spot lithium price and capacity growth', 'XME/MOO', ['ETF2', 'ETF3']),
  group('Strategic Raw Materials', 'Gas/LNG', 'INPUT', ['EQT', 'LNG'], ['Gas reserves'], ['Power Generation', 'Fertilizer'], 'Power, fertilizer, and global LNG demand', 'Pipeline and export capacity', 'XLE', ['RAW1']),
  group('Strategic Raw Materials', 'Integrated Oil', 'INPUT', ['XOM', 'CVX'], ['Reserves'], ['Refining', 'Chemicals'], 'Global oil and gas demand', 'Commodity prices and capex discipline', 'XLE', ['RAW1']),
  group('Strategic Raw Materials', 'Refining', 'DISTRIBUTION', ['MPC', 'VLO', 'PSX'], ['Integrated Oil'], ['Transport fuels', 'Chemicals'], 'Transport and industrial demand', 'Crack spreads and utilization', 'XLE', ['RAW1']),
];

const RELATIONSHIPS: RelationshipSeed[] = [
  rel('AI Infrastructure 2023', 'Semi Equipment', 'AI Infrastructure 2023', 'Foundry/OSAT', 'SUPPLIER_TO', 'SUPPLY_CHAIN_CAPACITY', undefined, 0.9, 'Fab capacity depends on lithography, deposition, inspection, and test tools.', ['AI5', 'ETF1']),
  rel('AI Infrastructure 2023', 'Semiconductor Inputs', 'AI Infrastructure 2023', 'Foundry/OSAT', 'SUPPLIER_TO', 'SUPPLY_CHAIN_CAPACITY', undefined, 0.75, 'Fabs require high-purity gases and process materials.', ['AI16']),
  rel('AI Infrastructure 2023', 'Foundry/OSAT', 'AI Infrastructure 2023', 'AI Chips', 'SUPPLIER_TO', 'SUPPLY_CHAIN_CAPACITY', undefined, 0.95, 'Chip designers depend on foundry and advanced packaging capacity.', ['AI4', 'AI15']),
  rel('AI Infrastructure 2023', 'AI Chips', 'AI Infrastructure 2023', 'AI Servers', 'SUPPLIER_TO', 'TECH_CYCLE', undefined, 0.95, 'GPU and ASIC availability drives AI server shipments.', ['AI1', 'AI2', 'AI7']),
  rel('AI Infrastructure 2023', 'Networking', 'AI Infrastructure 2023', 'AI Servers', 'BENEFITS', 'TECH_CYCLE', undefined, 0.85, 'Scale-out clusters need high-speed Ethernet and networking capacity.', ['AI6']),
  rel('AI Infrastructure 2023', 'AI Servers', 'AI Power Nuclear 2024', 'Cooling/Power', 'BENEFITS', 'TECH_CYCLE', undefined, 0.9, 'Dense AI racks raise power delivery and cooling demand.', ['AI7', 'AI9']),
  rel('AI Power Nuclear 2024', 'Cooling/Power', 'AI Power Nuclear 2024', 'Grid/Equipment', 'BENEFITS', 'SUPPLY_CHAIN_CAPACITY', undefined, 0.8, 'Data-center power density drives grid and electrical equipment demand.', ['AI10', 'AI11']),
  rel('AI Power Nuclear 2024', 'Grid/Equipment', 'Strategic Raw Materials', 'Copper', 'BENEFITS', 'SUPPLY_CHAIN_CAPACITY', 'COPPER', 0.75, 'Grid buildout and electrification increase copper demand.', ['RAW1', 'AI11']),
  rel('AI Infrastructure 2023', 'AI Chips', 'Defense Aerospace 2025', 'Defense IT/Cyber', 'LEADS', 'TECH_CYCLE', undefined, 0.55, 'AI compute availability enables defense AI and data platforms.', ['AI1', 'DEF4']),
  rel('Defense Aerospace 2025', 'Defense Primes', 'Defense Aerospace 2025', 'Defense IT/Cyber', 'BENEFITS', 'GEOPOLITICS_WAR', undefined, 0.65, 'Platform modernization pulls software, data, and cyber integration.', ['DEF1', 'DEF3']),
  rel('Defense Aerospace 2025', 'Defense IT/Cyber', 'Defense Aerospace 2025', 'Public Safety AI', 'BENEFITS', 'POLICY_REGULATION', undefined, 0.55, 'Defense AI workflows can spill into public safety technology.', ['DEF3', 'DEF4']),
  rel('Strategic Raw Materials', 'Steel', 'Defense Aerospace 2025', 'Defense Primes', 'SUPPLIER_TO', 'SUPPLY_CHAIN_CAPACITY', undefined, 0.6, 'Defense platforms and shipbuilding consume specialty steel.', ['RAW3', 'DEF5']),
  rel('Strategic Raw Materials', 'Aluminum', 'Defense Aerospace 2025', 'Defense Primes', 'SUPPLIER_TO', 'SUPPLY_CHAIN_CAPACITY', undefined, 0.65, 'Aerospace and defense platforms consume aluminum.', ['RAW2', 'DEF5']),
  rel('Strategic Raw Materials', 'Gas/LNG', 'Agriculture Inputs & Processing', 'Fertilizer', 'HURTS', 'INFLATION_COST', 'OIL', 0.75, 'Natural gas is a key nitrogen fertilizer input, so high gas can pressure margins.', ['AG2']),
  rel('Agriculture Inputs & Processing', 'Fertilizer', 'Agriculture Inputs & Processing', 'Ag Processing/Trading', 'BENEFITS', 'INFLATION_COST', 'INFLATION', 0.55, 'Crop economics and acreage affect fertilizer and downstream ag activity.', ['AG2', 'AG4']),
  rel('Agriculture Inputs & Processing', 'Seeds/Crop Protection', 'Agriculture Inputs & Processing', 'Ag Processing/Trading', 'BENEFITS', 'SUPPLY_CHAIN_CAPACITY', undefined, 0.6, 'Yield protection supports crop output and processing volumes.', ['AG3', 'AG4']),
  rel('Agriculture Inputs & Processing', 'Ag Processing/Trading', 'Agriculture Inputs & Processing', 'Farm Equipment', 'LEADS', 'INFLATION_COST', 'INFLATION', 0.6, 'Farm income and crop cycles tend to lead equipment demand.', ['AG1', 'AG4']),
  rel('Strategic Raw Materials', 'Copper', 'AI Power Nuclear 2024', 'Cooling/Power', 'BENEFITS', 'COPPER', 'COPPER', 0.7, 'Copper confirms electrification and power infrastructure demand.', ['RAW1', 'AI10']),
  rel('Strategic Raw Materials', 'Integrated Oil', 'Strategic Raw Materials', 'Refining', 'SUPPLIER_TO', 'INFLATION_COST', 'OIL', 0.65, 'Refiners need crude and NGL feedstock, while margins depend on spreads.', ['RAW1']),
  rel('Strategic Raw Materials', 'Gas/LNG', 'AI Power Nuclear 2024', 'Power Generation', 'BENEFITS', 'INFLATION_COST', 'OIL', 0.55, 'Gas supply affects power generation economics and fuel availability.', ['AI12', 'RAW1']),
];

const CATALYSTS: CatalystSeed[] = [
  {
    title: 'AI capex and data-center buildout',
    theme: 'AI Infrastructure 2023',
    group: 'AI Chips',
    kind: 'CURRENT',
    eventCategory: 'TECH_CYCLE',
    hypothesis:
      'AI capex supports chips, foundry capacity, AI servers, networking, and second-order power/cooling infrastructure.',
    beneficiaries: ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'ANET', 'SMCI', 'DELL', 'VRT', 'ETN', 'GEV', 'FCX'],
    losers: ['AI application names without revenue leverage'],
    confirmation: ['SMH', 'AI server breadth', 'power/cooling breadth', 'copper confirmation'],
    rejection: ['SMH fails', 'AI server backlog weakens', 'power names diverge'],
    confidence: 0.78,
    sourceKeys: ['AI1', 'AI3', 'AI6', 'AI9', 'ETF1'],
    mechanisms: [
      {
        title: 'AI compute demand expands',
        description:
          'Hyperscaler and enterprise AI spending raises demand for accelerators, foundry capacity, servers, and networking.',
        sourceKeys: ['AI1', 'AI3', 'AI4', 'AI6', 'AI7'],
        impacts: [
          impact('AI Infrastructure 2023', 'AI Chips', 'BENEFITS', 'BENEFITS', 0.95, 'IMMEDIATE', 'AI accelerator demand is the first-order expression of the capex cycle.', ['AI1', 'AI3']),
          impact('AI Infrastructure 2023', 'Foundry/OSAT', 'BENEFITS', 'SUPPLIER_TO', 0.85, 'SHORT_TERM', 'Advanced-node and packaging capacity becomes a bottleneck as accelerator demand rises.', ['AI4', 'AI15']),
          impact('AI Infrastructure 2023', 'AI Servers', 'BENEFITS', 'BENEFITS', 0.9, 'SHORT_TERM', 'GPU availability pulls through rack-scale server and integration demand.', ['AI7', 'AI8', 'AI13']),
          impact('AI Infrastructure 2023', 'Networking', 'BENEFITS', 'BENEFITS', 0.82, 'SHORT_TERM', 'Scale-out AI clusters require high-speed data-center networking.', ['AI6']),
        ],
      },
      {
        title: 'Power density becomes a constraint',
        description:
          'Dense AI racks shift the catalyst into electrical, cooling, grid equipment, power generation, and copper demand.',
        sourceKeys: ['AI9', 'AI10', 'AI11', 'AI12', 'RAW1'],
        impacts: [
          impact('AI Power Nuclear 2024', 'Cooling/Power', 'BENEFITS', 'BENEFITS', 0.9, 'MEDIUM_TERM', 'Power delivery and thermal management become required infrastructure for AI deployment.', ['AI9', 'AI10']),
          impact('AI Power Nuclear 2024', 'Grid/Equipment', 'BENEFITS', 'BENEFITS', 0.82, 'MEDIUM_TERM', 'Data-center load growth raises demand for grid and electrification equipment.', ['AI11']),
          impact('AI Power Nuclear 2024', 'Power Generation', 'BENEFITS', 'BENEFITS', 0.68, 'LONG_TERM', 'Large AI loads increase interest in reliable baseload and clean power supply.', ['AI12']),
          impact('Strategic Raw Materials', 'Copper', 'BENEFITS', 'BENEFITS', 0.72, 'MEDIUM_TERM', 'Grid buildout and electrical equipment demand pull copper into the AI chain.', ['RAW1', 'AI10']),
        ],
      },
    ],
  },
  {
    title: 'Defense rearmament and software-defined military systems',
    theme: 'Defense Aerospace 2025',
    group: 'Defense Primes',
    kind: 'CURRENT',
    eventCategory: 'GEOPOLITICS_WAR',
    hypothesis:
      'Geopolitical pressure and defense modernization support primes, missiles/sensors, and defense AI/cyber services.',
    beneficiaries: ['LMT', 'NOC', 'GD', 'RTX', 'BA', 'PLTR', 'BAH', 'LDOS', 'SAIC', 'CACI'],
    losers: ['budget-sensitive non-defense industrials'],
    confirmation: ['ITA', 'defense primes', 'defense IT/cyber breadth'],
    rejection: ['ITA lags', 'contract headlines fail to lift group'],
    confidence: 0.72,
    sourceKeys: ['DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5'],
    mechanisms: [
      {
        title: 'Procurement and readiness demand rises',
        description:
          'Geopolitical pressure supports primes, aerospace systems, and materials tied to defense platforms.',
        sourceKeys: ['DEF1', 'DEF2', 'DEF5', 'RAW2', 'RAW3'],
        impacts: [
          impact('Defense Aerospace 2025', 'Defense Primes', 'BENEFITS', 'BENEFITS', 0.88, 'MEDIUM_TERM', 'Rearmament and modernization increase demand for defense platforms and systems.', ['DEF1', 'DEF2', 'DEF5']),
          impact('Strategic Raw Materials', 'Steel', 'BENEFITS', 'SUPPLIER_TO', 0.58, 'MEDIUM_TERM', 'Defense platforms and shipbuilding consume specialty steel.', ['RAW3', 'RAW4']),
          impact('Strategic Raw Materials', 'Aluminum', 'BENEFITS', 'SUPPLIER_TO', 0.6, 'MEDIUM_TERM', 'Aerospace and defense production consume aluminum.', ['RAW2']),
        ],
      },
      {
        title: 'Military systems become software-defined',
        description:
          'AI, data fusion, cyber, and autonomy become a second-order defense modernization lane.',
        sourceKeys: ['DEF3', 'DEF4', 'AI1'],
        impacts: [
          impact('Defense Aerospace 2025', 'Defense IT/Cyber', 'BENEFITS', 'BENEFITS', 0.76, 'SHORT_TERM', 'Modernization spending supports data, cyber, AI, and mission software providers.', ['DEF3', 'DEF4']),
          impact('AI Infrastructure 2023', 'AI Chips', 'MIXED', 'LEADS', 0.5, 'LONG_TERM', 'AI compute enables defense AI but export controls and procurement timing can create uneven impact.', ['AI1', 'DEF4']),
          impact('Defense Aerospace 2025', 'Public Safety AI', 'BENEFITS', 'BENEFITS', 0.48, 'LONG_TERM', 'Defense AI workflows can spill into public safety and evidence management tooling.', ['DEF3', 'DEF4']),
        ],
      },
    ],
  },
  {
    title: 'Agriculture input and crop-cycle recovery',
    theme: 'Agriculture Inputs & Processing',
    group: 'Fertilizer',
    kind: 'PATTERN',
    eventCategory: 'INFLATION_COST',
    hypothesis:
      'Crop economics and food demand support fertilizer, crop protection, equipment, and processing/trading names.',
    beneficiaries: ['NTR', 'MOS', 'CF', 'CTVA', 'FMC', 'DE', 'AGCO', 'ADM', 'BG'],
    losers: ['food processors if input costs outrun pricing'],
    confirmation: ['MOO', 'fertilizer names', 'crop prices', 'farm equipment follow-through'],
    rejection: ['MOO weak', 'crop/fertilizer prices roll over'],
    confidence: 0.68,
    sourceKeys: ['AG1', 'AG2', 'AG3', 'AG4', 'ETF2'],
    mechanisms: [
      {
        title: 'Crop economics improve',
        description:
          'Better crop economics and planted acreage support fertilizer, seeds, crop protection, and downstream processing.',
        sourceKeys: ['AG2', 'AG3', 'AG4', 'ETF2'],
        impacts: [
          impact('Agriculture Inputs & Processing', 'Fertilizer', 'BENEFITS', 'BENEFITS', 0.78, 'SHORT_TERM', 'Crop economics and acreage can lift nutrient demand.', ['AG2', 'ETF2']),
          impact('Agriculture Inputs & Processing', 'Seeds/Crop Protection', 'BENEFITS', 'BENEFITS', 0.64, 'MEDIUM_TERM', 'Yield protection spending improves when grower economics stabilize.', ['AG3', 'ETF2']),
          impact('Agriculture Inputs & Processing', 'Ag Processing/Trading', 'BENEFITS', 'BENEFITS', 0.58, 'MEDIUM_TERM', 'Higher crop volumes and volatility can support processing and merchandising activity.', ['AG4', 'ETF2']),
        ],
      },
      {
        title: 'Input costs and farm income drive equipment timing',
        description:
          'Gas costs affect fertilizer margins, while farm income drives equipment replacement and precision agriculture spend.',
        sourceKeys: ['AG1', 'AG2', 'RAW1'],
        impacts: [
          impact('Strategic Raw Materials', 'Gas/LNG', 'MIXED', 'HURTS', 0.68, 'SHORT_TERM', 'Natural gas can help gas producers but pressure nitrogen fertilizer margins when input costs spike.', ['AG2', 'RAW1']),
          impact('Agriculture Inputs & Processing', 'Farm Equipment', 'BENEFITS', 'LEADS', 0.56, 'LONG_TERM', 'Farm income tends to lead equipment replacement demand.', ['AG1', 'AG4']),
        ],
      },
    ],
  },
  {
    title: 'Strategic materials pull-through from AI, grid, defense, and infrastructure',
    theme: 'Strategic Raw Materials',
    group: 'Copper',
    kind: 'CURRENT',
    eventCategory: 'SUPPLY_CHAIN_CAPACITY',
    hypothesis:
      'AI power, grid investment, defense, agriculture, and infrastructure pull demand through copper, aluminum, steel, lithium, gas, LNG, and refining groups.',
    beneficiaries: ['FCX', 'AA', 'NUE', 'CLF', 'ALB', 'SQM', 'EQT', 'LNG', 'MPC', 'VLO', 'PSX'],
    losers: ['downstream margin absorbers'],
    confirmation: ['XME', 'copper', 'steel', 'energy/refining breadth'],
    rejection: ['XME fails', 'industrial demand weakens'],
    confidence: 0.7,
    sourceKeys: ['RAW1', 'RAW2', 'RAW3', 'RAW4', 'ETF3'],
    mechanisms: [
      {
        title: 'Electrification and grid demand pull metals',
        description:
          'AI power, grid investment, and infrastructure spending raise demand for copper, aluminum, and steel.',
        sourceKeys: ['RAW1', 'RAW2', 'RAW3', 'AI10', 'AI11'],
        impacts: [
          impact('Strategic Raw Materials', 'Copper', 'BENEFITS', 'BENEFITS', 0.84, 'MEDIUM_TERM', 'Grid buildout and electrification are copper-intensive.', ['RAW1', 'ETF3']),
          impact('Strategic Raw Materials', 'Aluminum', 'BENEFITS', 'BENEFITS', 0.62, 'MEDIUM_TERM', 'Grid, aerospace, transport, and packaging can pull aluminum demand.', ['RAW2', 'ETF3']),
          impact('Strategic Raw Materials', 'Steel', 'BENEFITS', 'BENEFITS', 0.66, 'MEDIUM_TERM', 'Infrastructure, defense, energy, and equipment cycles support steel demand.', ['RAW3', 'RAW4', 'ETF3']),
          impact('AI Power Nuclear 2024', 'Grid/Equipment', 'BENEFITS', 'SUPPLIER_TO', 0.72, 'MEDIUM_TERM', 'Metals demand confirms and feeds electrification equipment demand.', ['AI11', 'RAW1']),
        ],
      },
      {
        title: 'Commodity cost pressure reaches downstream users',
        description:
          'Materials strength can support producers while pressuring downstream margin absorbers if pricing power is weak.',
        sourceKeys: ['RAW1', 'RAW2', 'RAW3'],
        impacts: [
          impact('Defense Aerospace 2025', 'Defense Primes', 'MIXED', 'SUPPLIER_TO', 0.5, 'MEDIUM_TERM', 'Defense demand consumes metals, but higher input costs can affect margins until contracts reset.', ['DEF5', 'RAW2', 'RAW3']),
          impact('Agriculture Inputs & Processing', 'Farm Equipment', 'HARMS', 'HURTS', 0.52, 'SHORT_TERM', 'Steel inflation can pressure equipment margins if not passed through.', ['AG1', 'RAW3']),
          impact('Strategic Raw Materials', 'Refining', 'MIXED', undefined, 0.45, 'SHORT_TERM', 'Industrial demand helps cyclicals but refiners remain more tied to crack spreads than metal prices.', ['RAW1']),
        ],
      },
    ],
  },
];

function group(
  theme: string,
  name: string,
  layer: SupplyChainLayer,
  tickers: string[],
  upstream: string[],
  downstream: string[],
  demandDriver: string,
  bottleneck: string,
  proxy: string,
  sourceKeys: string[],
): GroupSeed {
  return {
    theme,
    name,
    layer,
    tickers,
    upstream,
    downstream,
    demandDriver,
    bottleneck,
    proxy,
    sourceKeys,
  };
}

function rel(
  sourceTheme: string,
  sourceGroup: string,
  targetTheme: string,
  targetGroup: string,
  relationshipType: RelationshipType,
  eventCategory: string,
  macroSensitivity: MacroSensitivity | undefined,
  strength: number,
  reason: string,
  sourceKeys: string[],
  lagDays?: number,
): RelationshipSeed {
  return {
    sourceGroup: groupKey(sourceTheme, sourceGroup),
    targetGroup: groupKey(targetTheme, targetGroup),
    relationshipType,
    eventCategory,
    macroSensitivity,
    strength,
    reason,
    sourceKeys,
    lagDays,
  };
}

function impact(
  theme: string,
  groupName: string,
  direction: CatalystImpactDirection,
  relationshipType: RelationshipType | undefined,
  strength: number,
  timeframe: CatalystImpactTimeframe,
  notes: string,
  sourceKeys: string[],
): CatalystImpactSeed {
  return {
    theme,
    group: groupName,
    direction,
    relationshipType,
    strength,
    timeframe,
    notes,
    sourceKeys,
  };
}

function groupKey(theme: string, groupName: string): string {
  return `${theme}::${groupName}`;
}

function uniqueStockSeeds(seeds: StockSeed[]): StockSeed[] {
  const byTickerTheme = new Map<string, StockSeed>();
  for (const seed of seeds) {
    const key = `${seed.ticker}::${seed.theme}`;
    if (!byTickerTheme.has(key)) byTickerTheme.set(key, seed);
  }
  return [...byTickerTheme.values()];
}

function evidence(sourceKeys: string[], extra: Record<string, unknown> = {}): Prisma.InputJsonValue {
  return {
    sourceKeys,
    sources: sourceKeys.map((key) => ({ key, ...SOURCES[key] })).filter((source) => source.url),
    ...extra,
  } as Prisma.InputJsonValue;
}

function urls(sourceKeys: string[]): string[] {
  return sourceKeys.map((key) => SOURCES[key]?.url).filter((url): url is string => Boolean(url));
}

function relationshipNotes(seed: RelationshipSeed): string {
  return [
    `eventCategory=${seed.eventCategory}`,
    seed.reason,
  ].join(' | ');
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;
  const allTickers = [...new Set(STOCKS.map((stock) => stock.ticker))];
  const existingStocks = await prisma.stock.findMany({
    where: { ticker: { in: allTickers } },
    select: { id: true, ticker: true },
  });
  const stockByTicker = new Map(existingStocks.map((stock) => [stock.ticker, stock]));
  const missing = allTickers.filter((ticker) => !stockByTicker.has(ticker));

  console.log(
    `Bootstrap relationship import (${dryRun ? 'dry-run' : 'apply'})`,
  );
  console.log(
    `themes=${THEMES.length} groups=${GROUPS.length} stocks=${allTickers.length} relationships=${RELATIONSHIPS.length} catalysts=${CATALYSTS.length}`,
  );

  if (missing.length > 0) {
    throw new Error(`Missing stock tickers; add these first: ${missing.join(', ')}`);
  }

  if (dryRun) {
    console.log('Dry run only. Re-run with --apply to write DB changes.');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const theme of THEMES) {
      await tx.theme.upsert({
        where: { name: theme.name },
        create: { name: theme.name, description: theme.description },
        update: { description: theme.description, isActive: true },
      });
    }

    const existingThemeNames = [...new Set(GROUPS.map((groupSeed) => groupSeed.theme))];
    const themes = await tx.theme.findMany({
      where: { name: { in: existingThemeNames } },
      select: { id: true, name: true },
    });
    const themeByName = new Map(themes.map((theme) => [theme.name, theme]));
    const groupByKey = new Map<string, { id: string; themeId: string; name: string }>();

    for (let i = 0; i < GROUPS.length; i++) {
      const seed = GROUPS[i];
      const theme = themeByName.get(seed.theme);
      if (!theme) throw new Error(`Theme not found: ${seed.theme}`);
      const created = await tx.supplyChainGroup.upsert({
        where: { themeId_name: { themeId: theme.id, name: seed.name } },
        create: {
          themeId: theme.id,
          name: seed.name,
          sortOrder: i,
          layer: seed.layer as never,
          evidenceJson: evidence(seed.sourceKeys, {
            upstream: seed.upstream,
            downstream: seed.downstream,
            demandDriver: seed.demandDriver,
            bottleneck: seed.bottleneck,
            confirmationProxy: seed.proxy,
          }),
        },
        update: {
          sortOrder: i,
          layer: seed.layer as never,
          evidenceJson: evidence(seed.sourceKeys, {
            upstream: seed.upstream,
            downstream: seed.downstream,
            demandDriver: seed.demandDriver,
            bottleneck: seed.bottleneck,
            confirmationProxy: seed.proxy,
          }),
        },
      });
      groupByKey.set(groupKey(seed.theme, seed.name), created);

      for (const ticker of seed.tickers) {
        const stock = stockByTicker.get(ticker);
        if (!stock) continue;
        await tx.themeStock.upsert({
          where: { stockId_groupId: { stockId: stock.id, groupId: created.id } },
          create: { stockId: stock.id, groupId: created.id },
          update: {},
        });
      }
    }

    for (const seed of STOCKS) {
      const stock = stockByTicker.get(seed.ticker);
      const theme = themeByName.get(seed.theme);
      const groupRecord = groupByKey.get(groupKey(seed.theme, seed.group));
      if (!stock || !theme || !groupRecord) continue;

      await tx.stock.update({
        where: { id: stock.id },
        data: {
          sector: seed.sector,
          industry: seed.industry,
          briefDescription: seed.description,
          metadataEvidenceJson: evidence(seed.sourceKeys, {
            bootstrapVersion: 'bootstrap-v1',
            source: 'codex_bootstrap_manual',
          }),
        },
      });

      await tx.tickerThemeMembership.upsert({
        where: { stockId_themeId: { stockId: stock.id, themeId: theme.id } },
        create: {
          stockId: stock.id,
          themeId: theme.id,
          groupId: groupRecord.id,
          roleDescription: seed.role,
          importanceScore: new Prisma.Decimal(seed.importance),
          isPrimaryTheme: seed.importance >= 0.9,
          source: 'codex_bootstrap_manual',
          evidenceJson: evidence(seed.sourceKeys, { role: seed.role }),
        },
        update: {
          groupId: groupRecord.id,
          roleDescription: seed.role,
          importanceScore: new Prisma.Decimal(seed.importance),
          isPrimaryTheme: seed.importance >= 0.9,
          source: 'codex_bootstrap_manual',
          evidenceJson: evidence(seed.sourceKeys, { role: seed.role }),
          reviewedAt: new Date(),
        },
      });
    }

    for (const seed of RELATIONSHIPS) {
      const sourceGroup = groupByKey.get(seed.sourceGroup);
      const targetGroup = groupByKey.get(seed.targetGroup);
      if (!sourceGroup || !targetGroup) {
        throw new Error(`Relationship group missing: ${seed.sourceGroup} -> ${seed.targetGroup}`);
      }
      await tx.groupRelationship.upsert({
        where: {
          sourceGroupId_targetGroupId_relationshipType: {
            sourceGroupId: sourceGroup.id,
            targetGroupId: targetGroup.id,
            relationshipType: seed.relationshipType as never,
          },
        },
        create: {
          sourceGroupId: sourceGroup.id,
          targetGroupId: targetGroup.id,
          relationshipType: seed.relationshipType as never,
          macroSensitivity: (seed.macroSensitivity ?? null) as never,
          eventCategory: seed.eventCategory,
          strengthScore: new Prisma.Decimal(seed.strength),
          lagDaysEstimate: seed.lagDays ?? null,
          source: 'codex_bootstrap_manual',
          notes: relationshipNotes(seed),
          evidenceJson: evidence(seed.sourceKeys, { reason: seed.reason }),
        },
        update: {
          macroSensitivity: (seed.macroSensitivity ?? null) as never,
          eventCategory: seed.eventCategory,
          strengthScore: new Prisma.Decimal(seed.strength),
          lagDaysEstimate: seed.lagDays ?? null,
          source: 'codex_bootstrap_manual',
          notes: relationshipNotes(seed),
          evidenceJson: evidence(seed.sourceKeys, { reason: seed.reason }),
        },
      });
    }

    for (const seed of CATALYSTS) {
      const theme = themeByName.get(seed.theme);
      const groupRecord = seed.group
        ? groupByKey.get(groupKey(seed.theme, seed.group))
        : null;
      if (!theme) throw new Error(`Catalyst theme not found: ${seed.theme}`);

      const existing = await tx.catalystHypothesis.findFirst({
        where: { title: seed.title, themeId: theme.id },
        select: { id: true },
      });
      const data = {
        themeId: theme.id,
        groupId: groupRecord?.id ?? null,
        kind: seed.kind as never,
        eventCategory: seed.eventCategory,
        hypothesis: seed.hypothesis,
        sourceUrlsJson: urls(seed.sourceKeys),
        evidenceJson: evidence(seed.sourceKeys, {
          confirmation: seed.confirmation,
          rejection: seed.rejection,
        }),
        expectedBeneficiariesJson: seed.beneficiaries,
        expectedLosersJson: seed.losers,
        confidenceScore: new Prisma.Decimal(seed.confidence),
        status: 'WATCHING' as const,
      };

      let catalystId: string;
      if (existing) {
        const updated = await tx.catalystHypothesis.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        catalystId = updated.id;
      } else {
        const created = await tx.catalystHypothesis.create({
          data: { title: seed.title, ...data },
          select: { id: true },
        });
        catalystId = created.id;
      }

      await tx.catalystMechanism.deleteMany({ where: { catalystId } });
      for (let index = 0; index < seed.mechanisms.length; index++) {
        const mechanismSeed = seed.mechanisms[index];
        const mechanism = await tx.catalystMechanism.create({
          data: {
            catalystId,
            title: mechanismSeed.title,
            description: mechanismSeed.description,
            sortOrder: index,
            evidenceJson: evidence(mechanismSeed.sourceKeys),
          },
          select: { id: true },
        });

        for (const impactSeed of mechanismSeed.impacts) {
          const impactGroup = groupByKey.get(
            groupKey(impactSeed.theme, impactSeed.group),
          );
          if (!impactGroup) {
            throw new Error(
              `Catalyst impact group missing: ${impactSeed.theme} -> ${impactSeed.group}`,
            );
          }
          await tx.catalystImpact.create({
            data: {
              mechanismId: mechanism.id,
              groupId: impactGroup.id,
              direction: impactSeed.direction as never,
              relationshipType: (impactSeed.relationshipType ?? null) as never,
              strengthScore: new Prisma.Decimal(impactSeed.strength),
              timeframe: impactSeed.timeframe as never,
              notes: impactSeed.notes,
              evidenceJson: evidence(impactSeed.sourceKeys, {
                reason: impactSeed.notes,
              }),
            },
          });
        }
      }
    }
  });

  console.log('Bootstrap relationship import complete.');
}

const stockDescriptions: Record<string, string> = {
  NVDA: 'NVIDIA supplies accelerated computing platforms, GPUs, networking, and software used across AI data centers.',
  AMD: 'AMD supplies CPUs, GPUs, adaptive SoCs, and AI accelerators for data-center and client markets.',
  AVGO: 'Broadcom supplies custom AI accelerators, networking silicon, and infrastructure software.',
  TSM: 'TSMC is a leading semiconductor foundry manufacturing advanced-node chips for fabless designers.',
  ASML: 'ASML supplies lithography systems used by advanced semiconductor manufacturers.',
  AMAT: 'Applied Materials supplies wafer fabrication equipment and services.',
  LRCX: 'Lam Research supplies wafer fabrication equipment, especially etch and deposition tools.',
  KLAC: 'KLA supplies process control and inspection systems for semiconductor manufacturing.',
  TER: 'Teradyne supplies automated test equipment for semiconductors and electronics.',
  GFS: 'GlobalFoundries provides specialty semiconductor foundry manufacturing.',
  ASX: 'ASE Technology provides semiconductor assembly, packaging, and testing services.',
  LIN: 'Linde supplies industrial gases, including high-purity gases for semiconductor manufacturing.',
  SMCI: 'Supermicro designs and integrates high-performance servers and AI infrastructure.',
  DELL: 'Dell provides servers, storage, networking, and AI infrastructure solutions.',
  HPE: 'Hewlett Packard Enterprise provides servers, networking, storage, and hybrid cloud infrastructure.',
  CLS: 'Celestica provides electronics manufacturing and AI/data-center hardware integration.',
  FLEX: 'Flex provides manufacturing and supply-chain services for data center and power infrastructure.',
  ANET: 'Arista supplies cloud and AI data-center networking platforms.',
  CSCO: 'Cisco supplies enterprise, cloud, and data-center networking infrastructure.',
  VRT: 'Vertiv supplies data-center power, thermal management, and infrastructure equipment.',
  ETN: 'Eaton supplies electrical power management and grid/data-center equipment.',
  GEV: 'GE Vernova supplies power generation, grid, and electrification equipment.',
  CEG: 'Constellation Energy is a large nuclear and clean power generation company.',
  PLTR: 'Palantir provides data integration and AI software for commercial and defense customers.',
  LMT: 'Lockheed Martin is a defense prime focused on aircraft, missiles, space, and defense systems.',
  NOC: 'Northrop Grumman is a defense prime focused on aerospace, defense, and space systems.',
  GD: 'General Dynamics is a defense prime focused on aerospace, marine systems, combat systems, and IT.',
  RTX: 'RTX supplies aerospace systems, defense sensors, missiles, and engines.',
  BA: 'Boeing supplies commercial aircraft and defense/aerospace systems.',
  BAH: 'Booz Allen Hamilton provides consulting, AI, cyber, and technology services to government customers.',
  LDOS: 'Leidos provides defense, intelligence, civil, and health technology services.',
  SAIC: 'SAIC provides government IT, engineering, and mission services.',
  CACI: 'CACI provides defense, intelligence, cyber, and IT services.',
  AXON: 'Axon provides public-safety devices, cloud software, evidence management, and AI workflow tools.',
  DE: 'Deere supplies agricultural, construction, and forestry equipment with precision agriculture technology.',
  AGCO: 'AGCO supplies tractors, combines, and other agricultural equipment.',
  NTR: 'Nutrien produces potash, nitrogen, and phosphate and operates agricultural retail distribution.',
  MOS: 'Mosaic produces phosphate and potash crop nutrients.',
  CF: 'CF Industries produces nitrogen fertilizers.',
  CTVA: 'Corteva supplies seeds, traits, and crop protection products.',
  FMC: 'FMC supplies crop protection chemicals.',
  ADM: 'ADM originates, processes, transports, and merchandises agricultural commodities.',
  BG: 'Bunge processes and trades oilseeds, grains, and food/feed ingredients.',
  FCX: 'Freeport-McMoRan is a major copper producer with mining operations.',
  AA: 'Alcoa produces bauxite, alumina, and aluminum.',
  NUE: 'Nucor produces steel and steel products, including electric arc furnace steel.',
  CLF: 'Cleveland-Cliffs produces iron ore and steel for automotive and industrial customers.',
  ALB: 'Albemarle produces lithium and specialty chemicals.',
  SQM: 'SQM produces lithium, potassium, and specialty plant nutrients.',
  XOM: 'Exxon Mobil is an integrated oil and gas producer and refiner.',
  CVX: 'Chevron is an integrated oil and gas producer and refiner.',
  EQT: 'EQT is a natural gas producer.',
  LNG: 'Cheniere Energy operates LNG export infrastructure.',
  MPC: 'Marathon Petroleum operates refining and midstream assets.',
  VLO: 'Valero Energy operates refining and renewable fuels assets.',
  PSX: 'Phillips 66 operates refining, midstream, and chemicals assets.',
};

const stockRoles: Record<string, string> = {
  NVDA: 'AI GPU and accelerated computing platform leader',
  AMD: 'AI accelerator and CPU challenger',
  AVGO: 'custom AI ASIC and networking silicon supplier',
  TSM: 'advanced-node foundry supplier',
  ASML: 'lithography bottleneck equipment supplier',
  LIN: 'semiconductor gas input supplier',
  SMCI: 'AI server integrator',
  ANET: 'AI data-center Ethernet networking supplier',
  VRT: 'data-center power and cooling supplier',
  ETN: 'electrical equipment and power management supplier',
  GEV: 'grid and power equipment supplier',
  CEG: 'clean baseload power supplier',
  PLTR: 'defense AI and data platform',
  LMT: 'defense prime',
  RTX: 'missiles, sensors, and aerospace systems supplier',
  BAH: 'defense AI/cyber consulting platform',
  DE: 'precision agriculture equipment leader',
  NTR: 'fertilizer producer and ag retailer',
  CTVA: 'seed and crop-protection supplier',
  ADM: 'ag processing and trading platform',
  FCX: 'copper producer',
  NUE: 'steel producer',
  EQT: 'natural gas input supplier',
  LNG: 'LNG export infrastructure',
};

const stockSectors: Record<string, string> = {
  NVDA: 'Technology', AMD: 'Technology', AVGO: 'Technology', TSM: 'Technology', ASML: 'Technology', AMAT: 'Technology', LRCX: 'Technology', KLAC: 'Technology', TER: 'Technology', GFS: 'Technology', ASX: 'Technology', LIN: 'Materials', SMCI: 'Technology', DELL: 'Technology', HPE: 'Technology', CLS: 'Technology', FLEX: 'Technology', ANET: 'Technology', CSCO: 'Technology', VRT: 'Industrials', ETN: 'Industrials', GEV: 'Industrials', CEG: 'Utilities', PLTR: 'Technology', LMT: 'Industrials', NOC: 'Industrials', GD: 'Industrials', RTX: 'Industrials', BA: 'Industrials', LDOS: 'Industrials', SAIC: 'Industrials', CACI: 'Industrials', BAH: 'Industrials', AXON: 'Industrials', DE: 'Industrials', AGCO: 'Industrials', MOS: 'Materials', NTR: 'Materials', CF: 'Materials', CTVA: 'Materials', FMC: 'Materials', ADM: 'Consumer Staples', BG: 'Consumer Staples', FCX: 'Materials', AA: 'Materials', NUE: 'Materials', CLF: 'Materials', ALB: 'Materials', SQM: 'Materials', XOM: 'Energy', CVX: 'Energy', EQT: 'Energy', LNG: 'Energy', MPC: 'Energy', VLO: 'Energy', PSX: 'Energy',
};

const stockIndustries: Record<string, string> = {
  NVDA: 'Semiconductors', AMD: 'Semiconductors', AVGO: 'Semiconductors', TSM: 'Semiconductor Foundry', ASML: 'Semiconductor Equipment', AMAT: 'Semiconductor Equipment', LRCX: 'Semiconductor Equipment', KLAC: 'Semiconductor Equipment', TER: 'Semiconductor Test Equipment', GFS: 'Semiconductor Foundry', ASX: 'Semiconductor Packaging and Test', LIN: 'Industrial Gases', SMCI: 'AI Servers', DELL: 'AI Servers', HPE: 'AI Servers', CLS: 'Electronics Manufacturing', FLEX: 'Electronics Manufacturing', ANET: 'Data Center Networking', CSCO: 'Networking', VRT: 'Data Center Power and Cooling', ETN: 'Electrical Equipment', GEV: 'Power Equipment', CEG: 'Nuclear Utility', PLTR: 'AI Analytics', LMT: 'Defense Primes', NOC: 'Defense Primes', GD: 'Defense Primes', RTX: 'Aerospace and Defense', BA: 'Aerospace and Defense', LDOS: 'Defense IT', SAIC: 'Defense IT', CACI: 'Defense IT', BAH: 'Defense Consulting', AXON: 'Public Safety Tech', DE: 'Farm Equipment', AGCO: 'Farm Equipment', MOS: 'Fertilizer', NTR: 'Fertilizer', CF: 'Nitrogen Fertilizer', CTVA: 'Seeds and Crop Protection', FMC: 'Crop Protection', ADM: 'Agricultural Processing', BG: 'Agricultural Processing', FCX: 'Copper Mining', AA: 'Aluminum', NUE: 'Steel', CLF: 'Steel', ALB: 'Lithium', SQM: 'Lithium and Fertilizer', XOM: 'Integrated Oil', CVX: 'Integrated Oil', EQT: 'Natural Gas E&P', LNG: 'LNG Export', MPC: 'Refining', VLO: 'Refining', PSX: 'Refining',
};

const STOCKS: StockSeed[] = uniqueStockSeeds(
  GROUPS.flatMap((groupSeed) =>
    groupSeed.tickers.map((ticker, index) => ({
      ticker,
      description:
        stockDescriptions[ticker] ?? `${ticker} participates in ${groupSeed.name}.`,
      sector: stockSectors[ticker] ?? 'Unknown',
      industry: stockIndustries[ticker] ?? groupSeed.name,
      theme: groupSeed.theme,
      group: groupSeed.name,
      role: stockRoles[ticker] ?? `${groupSeed.name} participant`,
      importance: index === 0 ? 0.9 : 0.75,
      sourceKeys: groupSeed.sourceKeys,
    })),
  ),
);

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
