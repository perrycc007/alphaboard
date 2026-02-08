// ─────────────────────────────────────────────────────────
// Master Stock Universe - Historical Market Leaders 2018-2025
// ─────────────────────────────────────────────────────────
// Each stock appears once; mapped to themes via ThemeStock.

export interface StockEntry {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  exchange: 'NASDAQ' | 'NYSE' | 'AMEX';
}

export const stocks: StockEntry[] = [
  // ── Semiconductors / Compute ──
  { ticker: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'AVGO', name: 'Broadcom Inc', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'QCOM', name: 'Qualcomm Inc', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'SWKS', name: 'Skyworks Solutions', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'ASML', name: 'ASML Holding', sector: 'Technology', industry: 'Semiconductor Equipment', exchange: 'NASDAQ' },
  { ticker: 'LRCX', name: 'Lam Research', sector: 'Technology', industry: 'Semiconductor Equipment', exchange: 'NASDAQ' },
  { ticker: 'AMAT', name: 'Applied Materials', sector: 'Technology', industry: 'Semiconductor Equipment', exchange: 'NASDAQ' },
  { ticker: 'CDNS', name: 'Cadence Design Systems', sector: 'Technology', industry: 'EDA Software', exchange: 'NASDAQ' },

  // ── Cloud SaaS / Security / DevOps ──
  { ticker: 'ZS', name: 'Zscaler Inc', sector: 'Technology', industry: 'Cybersecurity', exchange: 'NASDAQ' },
  { ticker: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Technology', industry: 'Cybersecurity', exchange: 'NASDAQ' },
  { ticker: 'OKTA', name: 'Okta Inc', sector: 'Technology', industry: 'Identity Security', exchange: 'NASDAQ' },
  { ticker: 'PANW', name: 'Palo Alto Networks', sector: 'Technology', industry: 'Cybersecurity', exchange: 'NASDAQ' },
  { ticker: 'FTNT', name: 'Fortinet Inc', sector: 'Technology', industry: 'Cybersecurity', exchange: 'NASDAQ' },
  { ticker: 'DDOG', name: 'Datadog Inc', sector: 'Technology', industry: 'Observability', exchange: 'NASDAQ' },
  { ticker: 'TWLO', name: 'Twilio Inc', sector: 'Technology', industry: 'Cloud Communications', exchange: 'NYSE' },
  { ticker: 'TTD', name: 'The Trade Desk', sector: 'Technology', industry: 'AdTech', exchange: 'NASDAQ' },
  { ticker: 'SHOP', name: 'Shopify Inc', sector: 'Technology', industry: 'E-commerce Platform', exchange: 'NYSE' },
  { ticker: 'HUBS', name: 'HubSpot Inc', sector: 'Technology', industry: 'Marketing SaaS', exchange: 'NYSE' },
  { ticker: 'BILL', name: 'BILL Holdings', sector: 'Technology', industry: 'Fintech SaaS', exchange: 'NYSE' },
  { ticker: 'PAYC', name: 'Paycom Software', sector: 'Technology', industry: 'HR SaaS', exchange: 'NYSE' },
  { ticker: 'NOW', name: 'ServiceNow Inc', sector: 'Technology', industry: 'Enterprise SaaS', exchange: 'NYSE' },
  { ticker: 'SNOW', name: 'Snowflake Inc', sector: 'Technology', industry: 'Cloud Data', exchange: 'NYSE' },

  // ── Stay-at-Home Tech (2020) ──
  { ticker: 'ZM', name: 'Zoom Video Communications', sector: 'Technology', industry: 'Video Communications', exchange: 'NASDAQ' },
  { ticker: 'ROKU', name: 'Roku Inc', sector: 'Communication Services', industry: 'Streaming Platform', exchange: 'NASDAQ' },
  { ticker: 'PTON', name: 'Peloton Interactive', sector: 'Consumer Discretionary', industry: 'Connected Fitness', exchange: 'NASDAQ' },
  { ticker: 'TDOC', name: 'Teladoc Health', sector: 'Healthcare', industry: 'Telemedicine', exchange: 'NYSE' },

  // ── EV + Clean Energy ──
  { ticker: 'TSLA', name: 'Tesla Inc', sector: 'Consumer Discretionary', industry: 'Electric Vehicles', exchange: 'NASDAQ' },
  { ticker: 'ENPH', name: 'Enphase Energy', sector: 'Technology', industry: 'Solar Inverters', exchange: 'NASDAQ' },
  { ticker: 'SEDG', name: 'SolarEdge Technologies', sector: 'Technology', industry: 'Solar Inverters', exchange: 'NASDAQ' },
  { ticker: 'NIO', name: 'NIO Inc', sector: 'Consumer Discretionary', industry: 'Electric Vehicles', exchange: 'NYSE' },
  { ticker: 'RUN', name: 'Sunrun Inc', sector: 'Industrials', industry: 'Residential Solar', exchange: 'NASDAQ' },
  { ticker: 'PLUG', name: 'Plug Power Inc', sector: 'Industrials', industry: 'Hydrogen Fuel Cells', exchange: 'NASDAQ' },

  // ── E-commerce / Fintech (2020) ──
  { ticker: 'ETSY', name: 'Etsy Inc', sector: 'Consumer Discretionary', industry: 'E-commerce Marketplace', exchange: 'NASDAQ' },
  { ticker: 'SE', name: 'Sea Limited', sector: 'Communication Services', industry: 'Digital Commerce', exchange: 'NYSE' },
  { ticker: 'MELI', name: 'MercadoLibre Inc', sector: 'Consumer Discretionary', industry: 'LatAm E-commerce', exchange: 'NASDAQ' },
  { ticker: 'SQ', name: 'Block Inc', sector: 'Financials', industry: 'Digital Payments', exchange: 'NYSE' },
  { ticker: 'FDX', name: 'FedEx Corp', sector: 'Industrials', industry: 'Logistics', exchange: 'NYSE' },

  // ── Commodities Supercycle (2021) ──
  { ticker: 'DVN', name: 'Devon Energy', sector: 'Energy', industry: 'Oil E&P', exchange: 'NYSE' },
  { ticker: 'CLF', name: 'Cleveland-Cliffs', sector: 'Materials', industry: 'Steel', exchange: 'NYSE' },
  { ticker: 'NUE', name: 'Nucor Corp', sector: 'Materials', industry: 'Steel', exchange: 'NYSE' },
  { ticker: 'ZIM', name: 'ZIM Integrated Shipping', sector: 'Industrials', industry: 'Container Shipping', exchange: 'NYSE' },
  { ticker: 'STLD', name: 'Steel Dynamics', sector: 'Materials', industry: 'Steel', exchange: 'NASDAQ' },
  { ticker: 'ARCH', name: 'Arch Resources', sector: 'Energy', industry: 'Coal', exchange: 'NYSE' },

  // ── Lithium + Battery (2021) ──
  { ticker: 'LAC', name: 'Lithium Americas', sector: 'Materials', industry: 'Lithium Mining', exchange: 'NYSE' },
  { ticker: 'SLI', name: 'Standard Lithium', sector: 'Materials', industry: 'Lithium Mining', exchange: 'AMEX' },
  { ticker: 'SGML', name: 'Sigma Lithium', sector: 'Materials', industry: 'Lithium Mining', exchange: 'NASDAQ' },
  { ticker: 'ALB', name: 'Albemarle Corp', sector: 'Materials', industry: 'Specialty Chemicals', exchange: 'NYSE' },
  { ticker: 'LTHM', name: 'Livent Corp', sector: 'Materials', industry: 'Lithium Processing', exchange: 'NYSE' },

  // ── Reopening (2021) ──
  { ticker: 'F', name: 'Ford Motor Co', sector: 'Consumer Discretionary', industry: 'Automobiles', exchange: 'NYSE' },
  { ticker: 'ABNB', name: 'Airbnb Inc', sector: 'Consumer Discretionary', industry: 'Travel Platform', exchange: 'NASDAQ' },
  { ticker: 'DASH', name: 'DoorDash Inc', sector: 'Consumer Discretionary', industry: 'Delivery Platform', exchange: 'NASDAQ' },
  { ticker: 'CCL', name: 'Carnival Corp', sector: 'Consumer Discretionary', industry: 'Cruise Lines', exchange: 'NYSE' },

  // ── Oil & Gas Supercycle (2022) ──
  { ticker: 'OXY', name: 'Occidental Petroleum', sector: 'Energy', industry: 'Oil E&P', exchange: 'NYSE' },
  { ticker: 'AR', name: 'Antero Resources', sector: 'Energy', industry: 'Natural Gas E&P', exchange: 'NYSE' },
  { ticker: 'CTRA', name: 'Coterra Energy', sector: 'Energy', industry: 'Oil & Gas E&P', exchange: 'NYSE' },
  { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', industry: 'Refining', exchange: 'NYSE' },
  { ticker: 'VLO', name: 'Valero Energy', sector: 'Energy', industry: 'Refining', exchange: 'NYSE' },
  { ticker: 'FANG', name: 'Diamondback Energy', sector: 'Energy', industry: 'Oil E&P', exchange: 'NASDAQ' },
  { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', industry: 'Integrated Oil', exchange: 'NYSE' },

  // ── Coal + NatGas (2022) ──
  { ticker: 'CEIX', name: 'CONSOL Energy', sector: 'Energy', industry: 'Coal', exchange: 'NYSE' },
  { ticker: 'CEG', name: 'Constellation Energy', sector: 'Utilities', industry: 'Nuclear Utility', exchange: 'NASDAQ' },
  { ticker: 'BTU', name: 'Peabody Energy', sector: 'Energy', industry: 'Coal', exchange: 'NYSE' },

  // ── Defense (2022) ──
  { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', industry: 'Defense Primes', exchange: 'NYSE' },
  { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', industry: 'Defense Primes', exchange: 'NYSE' },
  { ticker: 'GD', name: 'General Dynamics', sector: 'Industrials', industry: 'Defense Primes', exchange: 'NYSE' },
  { ticker: 'LDOS', name: 'Leidos Holdings', sector: 'Industrials', industry: 'Defense IT', exchange: 'NYSE' },

  // ── AI Infrastructure (2023) ──
  { ticker: 'SMCI', name: 'Super Micro Computer', sector: 'Technology', industry: 'AI Servers', exchange: 'NASDAQ' },
  { ticker: 'ANET', name: 'Arista Networks', sector: 'Technology', industry: 'Data Center Networking', exchange: 'NYSE' },
  { ticker: 'VRT', name: 'Vertiv Holdings', sector: 'Industrials', industry: 'Data Center Cooling', exchange: 'NYSE' },

  // ── AI Software (2023) ──
  { ticker: 'PLTR', name: 'Palantir Technologies', sector: 'Technology', industry: 'AI Analytics', exchange: 'NYSE' },

  // ── Crypto Recovery (2023) ──
  { ticker: 'COIN', name: 'Coinbase Global', sector: 'Financials', industry: 'Crypto Exchange', exchange: 'NASDAQ' },
  { ticker: 'MARA', name: 'Marathon Digital Holdings', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'RIOT', name: 'Riot Platforms', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'MSTR', name: 'MicroStrategy Inc', sector: 'Technology', industry: 'Bitcoin Proxy', exchange: 'NASDAQ' },

  // ── AI Power + Nuclear (2024) ──
  { ticker: 'VST', name: 'Vistra Corp', sector: 'Utilities', industry: 'Power Generation', exchange: 'NYSE' },
  { ticker: 'GEV', name: 'GE Vernova', sector: 'Industrials', industry: 'Power Equipment', exchange: 'NYSE' },
  { ticker: 'OKLO', name: 'Oklo Inc', sector: 'Utilities', industry: 'Advanced Nuclear', exchange: 'NYSE' },
  { ticker: 'NNE', name: 'Nano Nuclear Energy', sector: 'Utilities', industry: 'Micro Reactors', exchange: 'AMEX' },
  { ticker: 'TLN', name: 'Talen Energy', sector: 'Utilities', industry: 'Power Generation', exchange: 'NASDAQ' },

  // ── AI Infra Wave 2 (2024) ──
  { ticker: 'APP', name: 'AppLovin Corp', sector: 'Technology', industry: 'Mobile AdTech', exchange: 'NASDAQ' },
  { ticker: 'AXON', name: 'Axon Enterprise', sector: 'Industrials', industry: 'Public Safety Tech', exchange: 'NASDAQ' },

  // ── Quantum Computing (2024) ──
  { ticker: 'RGTI', name: 'Rigetti Computing', sector: 'Technology', industry: 'Quantum Computing', exchange: 'NASDAQ' },
  { ticker: 'IONQ', name: 'IonQ Inc', sector: 'Technology', industry: 'Quantum Computing', exchange: 'NYSE' },
  { ticker: 'QBTS', name: 'D-Wave Quantum', sector: 'Technology', industry: 'Quantum Computing', exchange: 'NYSE' },

  // ── Reopening / Meme that became real leaders ──
  { ticker: 'MRNA', name: 'Moderna Inc', sector: 'Healthcare', industry: 'Biotech mRNA', exchange: 'NASDAQ' },

  // ── Additional Mega-caps for reference universe ──
  { ticker: 'AAPL', name: 'Apple Inc', sector: 'Technology', industry: 'Consumer Electronics', exchange: 'NASDAQ' },
  { ticker: 'MSFT', name: 'Microsoft Corp', sector: 'Technology', industry: 'Enterprise Software', exchange: 'NASDAQ' },
  { ticker: 'META', name: 'Meta Platforms', sector: 'Communication Services', industry: 'Social Media', exchange: 'NASDAQ' },
  { ticker: 'GOOGL', name: 'Alphabet Inc', sector: 'Communication Services', industry: 'Internet Services', exchange: 'NASDAQ' },
  { ticker: 'AMZN', name: 'Amazon.com', sector: 'Consumer Discretionary', industry: 'E-commerce', exchange: 'NASDAQ' },
  { ticker: 'NFLX', name: 'Netflix Inc', sector: 'Communication Services', industry: 'Streaming', exchange: 'NASDAQ' },
];

// ─────────────────────────────────────────────────────────
// Themes by Era with Supply Chain Groups and Stock Mappings
// ─────────────────────────────────────────────────────────

export interface ThemeEntry {
  name: string;
  description: string;
  groups: {
    name: string;
    tickers: string[];
  }[];
}

export const themes: ThemeEntry[] = [
  // ═══════════════════════ 2018 ═══════════════════════
  {
    name: 'Cloud SaaS Buildout 2018',
    description: 'First wave of cloud-native IPOs breaking out with massive volume',
    groups: [
      { name: 'Security', tickers: ['ZS', 'OKTA'] },
      { name: 'DevOps/Observability', tickers: ['DDOG', 'HUBS'] },
      { name: 'Commerce', tickers: ['SHOP', 'TTD'] },
      { name: 'Communication', tickers: ['TWLO'] },
    ],
  },
  {
    name: 'Semiconductors 5G Ramp 2018',
    description: "AMD's comeback and early 5G capex cycle",
    groups: [
      { name: 'Compute', tickers: ['AMD'] },
      { name: 'Equipment', tickers: ['LRCX', 'AMAT', 'ASML'] },
      { name: 'RF/Analog', tickers: ['SWKS', 'QCOM'] },
    ],
  },

  // ═══════════════════════ 2019 ═══════════════════════
  {
    name: 'Cloud SaaS Wave 2 2019',
    description: 'IPO class of 2019 breakouts with accelerating growth',
    groups: [
      { name: 'Security', tickers: ['CRWD', 'ZS'] },
      { name: 'Observability', tickers: ['DDOG'] },
      { name: 'Payments/Fintech', tickers: ['PAYC', 'BILL'] },
      { name: 'EDA', tickers: ['CDNS'] },
    ],
  },
  {
    name: 'Semiconductor Cycle 2019',
    description: 'Trade-war recovery and equipment restocking cycle',
    groups: [
      { name: 'Compute', tickers: ['AMD'] },
      { name: 'Equipment', tickers: ['LRCX', 'AMAT'] },
      { name: 'EDA', tickers: ['CDNS'] },
    ],
  },

  // ═══════════════════════ 2020 ═══════════════════════
  {
    name: 'Stay-at-Home Tech 2020',
    description: 'Remote work, streaming, and telemedicine during COVID lockdowns',
    groups: [
      { name: 'Video/Collab', tickers: ['ZM'] },
      { name: 'Cybersecurity', tickers: ['CRWD'] },
      { name: 'Observability', tickers: ['DDOG'] },
      { name: 'Streaming', tickers: ['ROKU', 'NFLX'] },
      { name: 'Connected Fitness', tickers: ['PTON'] },
      { name: 'Telemedicine', tickers: ['TDOC'] },
    ],
  },
  {
    name: 'EV + Clean Energy 2020',
    description: 'Tesla supercycle and solar/battery breakouts on massive volume',
    groups: [
      { name: 'EV OEMs', tickers: ['TSLA', 'NIO'] },
      { name: 'Solar', tickers: ['ENPH', 'SEDG', 'RUN'] },
      { name: 'Hydrogen/Fuel Cells', tickers: ['PLUG'] },
    ],
  },
  {
    name: 'E-commerce Fintech 2020',
    description: 'Pandemic accelerated digital commerce and payments adoption',
    groups: [
      { name: 'Marketplaces', tickers: ['ETSY', 'SE', 'MELI'] },
      { name: 'Payments', tickers: ['SQ'] },
      { name: 'Logistics', tickers: ['FDX'] },
    ],
  },

  // ═══════════════════════ 2021 ═══════════════════════
  {
    name: 'Commodities Supercycle 2021',
    description: 'Reopening inflation, supply chain squeeze, commodity price surge',
    groups: [
      { name: 'Oil E&P', tickers: ['DVN'] },
      { name: 'Steel/Metals', tickers: ['CLF', 'NUE', 'STLD'] },
      { name: 'Shipping', tickers: ['ZIM'] },
      { name: 'Coal', tickers: ['ARCH'] },
    ],
  },
  {
    name: 'Lithium + Battery 2021',
    description: 'EV demand pull-through driving lithium miners to multi-bagger runs',
    groups: [
      { name: 'Miners', tickers: ['LAC', 'SLI', 'SGML'] },
      { name: 'Processors', tickers: ['ALB', 'LTHM'] },
    ],
  },
  {
    name: 'Reopening Trade 2021',
    description: 'Consumer recovery plays as economies reopen from COVID',
    groups: [
      { name: 'Auto', tickers: ['F'] },
      { name: 'Travel', tickers: ['ABNB', 'CCL'] },
      { name: 'Delivery', tickers: ['DASH'] },
      { name: 'Biotech', tickers: ['MRNA'] },
    ],
  },

  // ═══════════════════════ 2022 ═══════════════════════
  {
    name: 'Oil Gas Supercycle 2022',
    description: 'Russia/Ukraine war and OPEC cuts driving energy to decade highs',
    groups: [
      { name: 'E&P', tickers: ['OXY', 'FANG', 'CTRA'] },
      { name: 'Natural Gas', tickers: ['AR'] },
      { name: 'Integrated', tickers: ['XOM'] },
      { name: 'Refining', tickers: ['MPC', 'VLO'] },
    ],
  },
  {
    name: 'Coal NatGas Crisis 2022',
    description: 'European energy crisis driving coal and nuclear utility stocks',
    groups: [
      { name: 'Coal Producers', tickers: ['CEIX', 'ARCH', 'BTU'] },
      { name: 'Nuclear Utility', tickers: ['CEG'] },
    ],
  },
  {
    name: 'Defense 2022',
    description: 'Geopolitical escalation driving defense spending and rearmament',
    groups: [
      { name: 'Defense Primes', tickers: ['LMT', 'NOC', 'GD'] },
      { name: 'Defense IT', tickers: ['LDOS'] },
    ],
  },

  // ═══════════════════════ 2023 ═══════════════════════
  {
    name: 'AI Infrastructure 2023',
    description: 'GPU and data center buildout wave 1 driven by ChatGPT explosion',
    groups: [
      { name: 'AI Chips', tickers: ['NVDA', 'AMD', 'AVGO'] },
      { name: 'AI Servers', tickers: ['SMCI'] },
      { name: 'Networking', tickers: ['ANET'] },
      { name: 'Cooling/Power', tickers: ['VRT'] },
    ],
  },
  {
    name: 'AI Software Platforms 2023',
    description: 'LLM and GenAI monetization driving AI software to breakouts',
    groups: [
      { name: 'AI Analytics', tickers: ['PLTR'] },
      { name: 'Security', tickers: ['CRWD', 'PANW'] },
      { name: 'Enterprise AI', tickers: ['NOW', 'SNOW', 'DDOG'] },
    ],
  },
  {
    name: 'Crypto Recovery 2023',
    description: 'Bitcoin halving pre-run and crypto exchange recovery',
    groups: [
      { name: 'Exchanges', tickers: ['COIN'] },
      { name: 'Mining', tickers: ['MARA', 'RIOT'] },
      { name: 'Bitcoin Proxy', tickers: ['MSTR'] },
    ],
  },

  // ═══════════════════════ 2024 ═══════════════════════
  {
    name: 'AI Power Nuclear 2024',
    description: 'Data center electricity demand driving nuclear and IPP stocks',
    groups: [
      { name: 'Nuclear', tickers: ['CEG', 'OKLO', 'NNE'] },
      { name: 'Power Generation', tickers: ['VST', 'TLN'] },
      { name: 'Grid/Equipment', tickers: ['GEV'] },
    ],
  },
  {
    name: 'AI Infra Wave 2 2024',
    description: 'Picks-and-shovels deepening with software monetization and edge AI',
    groups: [
      { name: 'AI Chips', tickers: ['NVDA', 'AVGO'] },
      { name: 'Software Monetization', tickers: ['APP', 'PLTR'] },
      { name: 'Networking', tickers: ['ANET'] },
      { name: 'Cooling', tickers: ['VRT'] },
      { name: 'Public Safety AI', tickers: ['AXON'] },
    ],
  },
  {
    name: 'Quantum Computing 2024',
    description: 'Speculative quantum theme emerging late 2024 with extreme volume',
    groups: [
      { name: 'Pure-play Quantum', tickers: ['RGTI', 'IONQ'] },
      { name: 'Quantum Annealing', tickers: ['QBTS'] },
    ],
  },

  // ═══════════════════════ 2025 ═══════════════════════
  {
    name: 'AI Agents Software 2025',
    description: 'Next wave of AI monetization through autonomous agents and automation',
    groups: [
      { name: 'AI Platforms', tickers: ['PLTR', 'NOW'] },
      { name: 'Security', tickers: ['CRWD', 'FTNT', 'PANW'] },
      { name: 'Automation', tickers: ['AXON'] },
    ],
  },
  {
    name: 'Defense Aerospace 2025',
    description: 'Global rearmament and increased defense budgets worldwide',
    groups: [
      { name: 'Primes', tickers: ['LMT', 'GD'] },
      { name: 'Defense IT/Cyber', tickers: ['LDOS', 'PLTR'] },
      { name: 'Public Safety', tickers: ['AXON'] },
    ],
  },
];
