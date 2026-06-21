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

  // Additional curated stocks used to keep every theme group reviewable
  { ticker: 'ESTC', name: 'Elastic NV', sector: 'Technology', industry: 'Search and Observability', exchange: 'NYSE' },
  { ticker: 'DOCU', name: 'DocuSign Inc', sector: 'Technology', industry: 'Agreement Cloud', exchange: 'NASDAQ' },
  { ticker: 'RNG', name: 'RingCentral Inc', sector: 'Technology', industry: 'Cloud Communications', exchange: 'NYSE' },
  { ticker: 'DBX', name: 'Dropbox Inc', sector: 'Technology', industry: 'Cloud Collaboration', exchange: 'NASDAQ' },
  { ticker: 'INTC', name: 'Intel Corp', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'MRVL', name: 'Marvell Technology', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'MU', name: 'Micron Technology', sector: 'Technology', industry: 'Memory Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'TXN', name: 'Texas Instruments', sector: 'Technology', industry: 'Analog Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'KLAC', name: 'KLA Corp', sector: 'Technology', industry: 'Semiconductor Equipment', exchange: 'NASDAQ' },
  { ticker: 'TER', name: 'Teradyne Inc', sector: 'Technology', industry: 'Semiconductor Test Equipment', exchange: 'NASDAQ' },
  { ticker: 'QRVO', name: 'Qorvo Inc', sector: 'Technology', industry: 'RF Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'ADI', name: 'Analog Devices', sector: 'Technology', industry: 'Analog Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'SPLK', name: 'Splunk Inc', sector: 'Technology', industry: 'Observability', exchange: 'NASDAQ' },
  { ticker: 'DT', name: 'Dynatrace Inc', sector: 'Technology', industry: 'Observability', exchange: 'NYSE' },
  { ticker: 'PYPL', name: 'PayPal Holdings', sector: 'Financials', industry: 'Digital Payments', exchange: 'NASDAQ' },
  { ticker: 'TOST', name: 'Toast Inc', sector: 'Technology', industry: 'Restaurant Fintech', exchange: 'NYSE' },
  { ticker: 'SNPS', name: 'Synopsys Inc', sector: 'Technology', industry: 'EDA Software', exchange: 'NASDAQ' },
  { ticker: 'ANSS', name: 'Ansys Inc', sector: 'Technology', industry: 'Engineering Simulation Software', exchange: 'NASDAQ' },
  { ticker: 'KEYS', name: 'Keysight Technologies', sector: 'Technology', industry: 'Electronic Design Test', exchange: 'NYSE' },
  { ticker: 'ADSK', name: 'Autodesk Inc', sector: 'Technology', industry: 'Design Software', exchange: 'NASDAQ' },
  { ticker: 'TEAM', name: 'Atlassian Corp', sector: 'Technology', industry: 'Collaboration Software', exchange: 'NASDAQ' },
  { ticker: 'DIS', name: 'Walt Disney Co', sector: 'Communication Services', industry: 'Media and Streaming', exchange: 'NYSE' },
  { ticker: 'SPOT', name: 'Spotify Technology', sector: 'Communication Services', industry: 'Audio Streaming', exchange: 'NYSE' },
  { ticker: 'PARA', name: 'Paramount Global', sector: 'Communication Services', industry: 'Media and Streaming', exchange: 'NASDAQ' },
  { ticker: 'LULU', name: 'Lululemon Athletica', sector: 'Consumer Discretionary', industry: 'Athletic Apparel', exchange: 'NASDAQ' },
  { ticker: 'NKE', name: 'Nike Inc', sector: 'Consumer Discretionary', industry: 'Athletic Apparel', exchange: 'NYSE' },
  { ticker: 'UAA', name: 'Under Armour Inc', sector: 'Consumer Discretionary', industry: 'Athletic Apparel', exchange: 'NYSE' },
  { ticker: 'WW', name: 'WW International', sector: 'Consumer Discretionary', industry: 'Wellness and Fitness', exchange: 'NASDAQ' },
  { ticker: 'AMWL', name: 'American Well Corp', sector: 'Healthcare', industry: 'Telemedicine', exchange: 'NYSE' },
  { ticker: 'DOCS', name: 'Doximity Inc', sector: 'Healthcare', industry: 'Digital Health Platform', exchange: 'NYSE' },
  { ticker: 'HIMS', name: 'Hims & Hers Health', sector: 'Healthcare', industry: 'Telehealth', exchange: 'NYSE' },
  { ticker: 'ONEM', name: '1Life Healthcare', sector: 'Healthcare', industry: 'Primary Care Platform', exchange: 'NASDAQ' },
  { ticker: 'LI', name: 'Li Auto Inc', sector: 'Consumer Discretionary', industry: 'Electric Vehicles', exchange: 'NASDAQ' },
  { ticker: 'XPEV', name: 'XPeng Inc', sector: 'Consumer Discretionary', industry: 'Electric Vehicles', exchange: 'NYSE' },
  { ticker: 'RIVN', name: 'Rivian Automotive', sector: 'Consumer Discretionary', industry: 'Electric Vehicles', exchange: 'NASDAQ' },
  { ticker: 'FSLR', name: 'First Solar Inc', sector: 'Technology', industry: 'Solar Modules', exchange: 'NASDAQ' },
  { ticker: 'ARRY', name: 'Array Technologies', sector: 'Industrials', industry: 'Solar Tracking Systems', exchange: 'NASDAQ' },
  { ticker: 'BE', name: 'Bloom Energy', sector: 'Industrials', industry: 'Hydrogen Fuel Cells', exchange: 'NYSE' },
  { ticker: 'FCEL', name: 'FuelCell Energy', sector: 'Industrials', industry: 'Fuel Cells', exchange: 'NASDAQ' },
  { ticker: 'BLDP', name: 'Ballard Power Systems', sector: 'Industrials', industry: 'Hydrogen Fuel Cells', exchange: 'NASDAQ' },
  { ticker: 'NKLA', name: 'Nikola Corp', sector: 'Industrials', industry: 'Hydrogen Trucks', exchange: 'NASDAQ' },
  { ticker: 'AFRM', name: 'Affirm Holdings', sector: 'Financials', industry: 'Consumer Finance', exchange: 'NASDAQ' },
  { ticker: 'FOUR', name: 'Shift4 Payments', sector: 'Technology', industry: 'Digital Payments', exchange: 'NYSE' },
  { ticker: 'UPS', name: 'United Parcel Service', sector: 'Industrials', industry: 'Logistics', exchange: 'NYSE' },
  { ticker: 'CHRW', name: 'C.H. Robinson Worldwide', sector: 'Industrials', industry: 'Logistics', exchange: 'NASDAQ' },
  { ticker: 'EXPD', name: 'Expeditors International', sector: 'Industrials', industry: 'Freight Forwarding', exchange: 'NASDAQ' },
  { ticker: 'XPO', name: 'XPO Inc', sector: 'Industrials', industry: 'Logistics', exchange: 'NYSE' },
  { ticker: 'EOG', name: 'EOG Resources', sector: 'Energy', industry: 'Oil E&P', exchange: 'NYSE' },
  { ticker: 'APA', name: 'APA Corp', sector: 'Energy', industry: 'Oil & Gas E&P', exchange: 'NASDAQ' },
  { ticker: 'X', name: 'United States Steel', sector: 'Materials', industry: 'Steel', exchange: 'NYSE' },
  { ticker: 'AA', name: 'Alcoa Corp', sector: 'Materials', industry: 'Aluminum', exchange: 'NYSE' },
  { ticker: 'DAC', name: 'Danaos Corp', sector: 'Industrials', industry: 'Container Shipping', exchange: 'NYSE' },
  { ticker: 'GNK', name: 'Genco Shipping & Trading', sector: 'Industrials', industry: 'Dry Bulk Shipping', exchange: 'NYSE' },
  { ticker: 'SBLK', name: 'Star Bulk Carriers', sector: 'Industrials', industry: 'Dry Bulk Shipping', exchange: 'NASDAQ' },
  { ticker: 'CMRE', name: 'Costamare Inc', sector: 'Industrials', industry: 'Container Shipping', exchange: 'NYSE' },
  { ticker: 'AMR', name: 'Alpha Metallurgical Resources', sector: 'Energy', industry: 'Coal', exchange: 'NYSE' },
  { ticker: 'HCC', name: 'Warrior Met Coal', sector: 'Energy', industry: 'Coal', exchange: 'NYSE' },
  { ticker: 'SQM', name: 'Sociedad Quimica y Minera', sector: 'Materials', industry: 'Lithium Mining', exchange: 'NYSE' },
  { ticker: 'ALTM', name: 'Arcadium Lithium', sector: 'Materials', industry: 'Lithium Processing', exchange: 'NYSE' },
  { ticker: 'PLL', name: 'Piedmont Lithium', sector: 'Materials', industry: 'Lithium Mining', exchange: 'NASDAQ' },
  { ticker: 'GM', name: 'General Motors', sector: 'Consumer Discretionary', industry: 'Automobiles', exchange: 'NYSE' },
  { ticker: 'STLA', name: 'Stellantis NV', sector: 'Consumer Discretionary', industry: 'Automobiles', exchange: 'NYSE' },
  { ticker: 'RACE', name: 'Ferrari NV', sector: 'Consumer Discretionary', industry: 'Automobiles', exchange: 'NYSE' },
  { ticker: 'RCL', name: 'Royal Caribbean Group', sector: 'Consumer Discretionary', industry: 'Cruise Lines', exchange: 'NYSE' },
  { ticker: 'NCLH', name: 'Norwegian Cruise Line', sector: 'Consumer Discretionary', industry: 'Cruise Lines', exchange: 'NYSE' },
  { ticker: 'BKNG', name: 'Booking Holdings', sector: 'Consumer Discretionary', industry: 'Online Travel', exchange: 'NASDAQ' },
  { ticker: 'UBER', name: 'Uber Technologies', sector: 'Technology', industry: 'Mobility and Delivery', exchange: 'NYSE' },
  { ticker: 'LYFT', name: 'Lyft Inc', sector: 'Technology', industry: 'Mobility', exchange: 'NASDAQ' },
  { ticker: 'CART', name: 'Maplebear Inc', sector: 'Consumer Staples', industry: 'Grocery Delivery', exchange: 'NASDAQ' },
  { ticker: 'OLO', name: 'Olo Inc', sector: 'Technology', industry: 'Restaurant Ordering Platform', exchange: 'NYSE' },
  { ticker: 'BNTX', name: 'BioNTech SE', sector: 'Healthcare', industry: 'Biotech mRNA', exchange: 'NASDAQ' },
  { ticker: 'NVAX', name: 'Novavax Inc', sector: 'Healthcare', industry: 'Biotech Vaccines', exchange: 'NASDAQ' },
  { ticker: 'REGN', name: 'Regeneron Pharmaceuticals', sector: 'Healthcare', industry: 'Biotechnology', exchange: 'NASDAQ' },
  { ticker: 'VRTX', name: 'Vertex Pharmaceuticals', sector: 'Healthcare', industry: 'Biotechnology', exchange: 'NASDAQ' },
  { ticker: 'EQT', name: 'EQT Corp', sector: 'Energy', industry: 'Natural Gas E&P', exchange: 'NYSE' },
  { ticker: 'LNG', name: 'Cheniere Energy', sector: 'Energy', industry: 'LNG Export', exchange: 'NYSE' },
  { ticker: 'RRC', name: 'Range Resources', sector: 'Energy', industry: 'Natural Gas E&P', exchange: 'NYSE' },
  { ticker: 'CVX', name: 'Chevron Corp', sector: 'Energy', industry: 'Integrated Oil', exchange: 'NYSE' },
  { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', industry: 'Oil & Gas E&P', exchange: 'NYSE' },
  { ticker: 'SHEL', name: 'Shell plc', sector: 'Energy', industry: 'Integrated Oil', exchange: 'NYSE' },
  { ticker: 'BP', name: 'BP plc', sector: 'Energy', industry: 'Integrated Oil', exchange: 'NYSE' },
  { ticker: 'PSX', name: 'Phillips 66', sector: 'Energy', industry: 'Refining', exchange: 'NYSE' },
  { ticker: 'DINO', name: 'HF Sinclair', sector: 'Energy', industry: 'Refining', exchange: 'NYSE' },
  { ticker: 'PBF', name: 'PBF Energy', sector: 'Energy', industry: 'Refining', exchange: 'NYSE' },
  { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', industry: 'Electric Utility', exchange: 'NYSE' },
  { ticker: 'DUK', name: 'Duke Energy', sector: 'Utilities', industry: 'Electric Utility', exchange: 'NYSE' },
  { ticker: 'RTX', name: 'RTX Corp', sector: 'Industrials', industry: 'Defense Primes', exchange: 'NYSE' },
  { ticker: 'BA', name: 'Boeing Co', sector: 'Industrials', industry: 'Aerospace and Defense', exchange: 'NYSE' },
  { ticker: 'SAIC', name: 'Science Applications International', sector: 'Industrials', industry: 'Defense IT', exchange: 'NASDAQ' },
  { ticker: 'CACI', name: 'CACI International', sector: 'Industrials', industry: 'Defense IT', exchange: 'NYSE' },
  { ticker: 'BAH', name: 'Booz Allen Hamilton', sector: 'Industrials', industry: 'Defense Consulting', exchange: 'NYSE' },
  { ticker: 'ARM', name: 'Arm Holdings', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  { ticker: 'DELL', name: 'Dell Technologies', sector: 'Technology', industry: 'AI Servers', exchange: 'NYSE' },
  { ticker: 'HPE', name: 'Hewlett Packard Enterprise', sector: 'Technology', industry: 'AI Servers', exchange: 'NYSE' },
  { ticker: 'NTAP', name: 'NetApp Inc', sector: 'Technology', industry: 'Data Storage', exchange: 'NASDAQ' },
  { ticker: 'WDC', name: 'Western Digital', sector: 'Technology', industry: 'Data Storage', exchange: 'NASDAQ' },
  { ticker: 'CSCO', name: 'Cisco Systems', sector: 'Technology', industry: 'Networking', exchange: 'NASDAQ' },
  { ticker: 'JNPR', name: 'Juniper Networks', sector: 'Technology', industry: 'Networking', exchange: 'NYSE' },
  { ticker: 'CIEN', name: 'Ciena Corp', sector: 'Technology', industry: 'Optical Networking', exchange: 'NYSE' },
  { ticker: 'NTNX', name: 'Nutanix Inc', sector: 'Technology', industry: 'Hybrid Cloud Infrastructure', exchange: 'NASDAQ' },
  { ticker: 'ETN', name: 'Eaton Corp', sector: 'Industrials', industry: 'Electrical Equipment', exchange: 'NYSE' },
  { ticker: 'GNRC', name: 'Generac Holdings', sector: 'Industrials', industry: 'Power Equipment', exchange: 'NYSE' },
  { ticker: 'ST', name: 'Sensata Technologies', sector: 'Technology', industry: 'Industrial Sensors', exchange: 'NYSE' },
  { ticker: 'AI', name: 'C3.ai Inc', sector: 'Technology', industry: 'AI Software', exchange: 'NYSE' },
  { ticker: 'MDB', name: 'MongoDB Inc', sector: 'Technology', industry: 'Cloud Database', exchange: 'NASDAQ' },
  { ticker: 'CRM', name: 'Salesforce Inc', sector: 'Technology', industry: 'Enterprise SaaS', exchange: 'NYSE' },
  { ticker: 'HOOD', name: 'Robinhood Markets', sector: 'Financials', industry: 'Brokerage Platform', exchange: 'NASDAQ' },
  { ticker: 'IBKR', name: 'Interactive Brokers', sector: 'Financials', industry: 'Brokerage', exchange: 'NASDAQ' },
  { ticker: 'CME', name: 'CME Group', sector: 'Financials', industry: 'Exchange Operator', exchange: 'NASDAQ' },
  { ticker: 'SCHW', name: 'Charles Schwab', sector: 'Financials', industry: 'Brokerage', exchange: 'NYSE' },
  { ticker: 'CLSK', name: 'CleanSpark Inc', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'CIFR', name: 'Cipher Mining', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'WULF', name: 'TeraWulf Inc', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'HUT', name: 'Hut 8 Corp', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'BTBT', name: 'Bit Digital', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'IREN', name: 'IREN Ltd', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'CORZ', name: 'Core Scientific', sector: 'Financials', industry: 'Bitcoin Mining', exchange: 'NASDAQ' },
  { ticker: 'SMR', name: 'NuScale Power', sector: 'Utilities', industry: 'Small Modular Reactors', exchange: 'NYSE' },
  { ticker: 'LEU', name: 'Centrus Energy', sector: 'Energy', industry: 'Nuclear Fuel', exchange: 'AMEX' },
  { ticker: 'NRG', name: 'NRG Energy', sector: 'Utilities', industry: 'Power Generation', exchange: 'NYSE' },
  { ticker: 'EMR', name: 'Emerson Electric', sector: 'Industrials', industry: 'Industrial Automation', exchange: 'NYSE' },
  { ticker: 'ROK', name: 'Rockwell Automation', sector: 'Industrials', industry: 'Industrial Automation', exchange: 'NYSE' },
  { ticker: 'HUBB', name: 'Hubbell Inc', sector: 'Industrials', industry: 'Electrical Equipment', exchange: 'NYSE' },
  { ticker: 'QUBT', name: 'Quantum Computing Inc', sector: 'Technology', industry: 'Quantum Computing', exchange: 'NASDAQ' },
  { ticker: 'ARQQ', name: 'Arqit Quantum', sector: 'Technology', industry: 'Quantum Security', exchange: 'NASDAQ' },
  { ticker: 'PATH', name: 'UiPath Inc', sector: 'Technology', industry: 'Automation Software', exchange: 'NYSE' },

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
      { name: 'Security', tickers: ['ZS', 'OKTA', 'CRWD', 'PANW', 'FTNT'] },
      { name: 'DevOps/Observability', tickers: ['DDOG', 'HUBS', 'NOW', 'SNOW', 'ESTC'] },
      { name: 'Commerce', tickers: ['SHOP', 'TTD', 'ETSY', 'MELI', 'AMZN'] },
      { name: 'Communication', tickers: ['TWLO', 'ZM', 'DOCU', 'RNG', 'DBX'] },
    ],
  },
  {
    name: 'Semiconductors 5G Ramp 2018',
    description: "AMD's comeback and early 5G capex cycle",
    groups: [
      { name: 'Compute', tickers: ['AMD', 'NVDA', 'INTC', 'MRVL', 'MU'] },
      { name: 'Equipment', tickers: ['LRCX', 'AMAT', 'ASML', 'KLAC', 'TER'] },
      { name: 'RF/Analog', tickers: ['SWKS', 'QCOM', 'QRVO', 'ADI', 'TXN'] },
    ],
  },

  // ═══════════════════════ 2019 ═══════════════════════
  {
    name: 'Cloud SaaS Wave 2 2019',
    description: 'IPO class of 2019 breakouts with accelerating growth',
    groups: [
      { name: 'Security', tickers: ['CRWD', 'ZS', 'PANW', 'FTNT', 'OKTA'] },
      { name: 'Observability', tickers: ['DDOG', 'ESTC', 'SPLK', 'DT', 'SNOW'] },
      { name: 'Payments/Fintech', tickers: ['PAYC', 'BILL', 'SQ', 'PYPL', 'TOST'] },
      { name: 'EDA', tickers: ['CDNS', 'SNPS', 'ANSS', 'KEYS', 'ADSK'] },
    ],
  },
  {
    name: 'Semiconductor Cycle 2019',
    description: 'Trade-war recovery and equipment restocking cycle',
    groups: [
      { name: 'Compute', tickers: ['AMD', 'NVDA', 'INTC', 'MU', 'MRVL'] },
      { name: 'Equipment', tickers: ['LRCX', 'AMAT', 'ASML', 'KLAC', 'TER'] },
      { name: 'EDA', tickers: ['CDNS', 'SNPS', 'ANSS', 'KEYS', 'ADSK'] },
    ],
  },

  // ═══════════════════════ 2020 ═══════════════════════
  {
    name: 'Stay-at-Home Tech 2020',
    description: 'Remote work, streaming, and telemedicine during COVID lockdowns',
    groups: [
      { name: 'Video/Collab', tickers: ['ZM', 'DOCU', 'DBX', 'TEAM', 'MSFT'] },
      { name: 'Cybersecurity', tickers: ['CRWD', 'ZS', 'OKTA', 'PANW', 'FTNT'] },
      { name: 'Observability', tickers: ['DDOG', 'ESTC', 'DT', 'SNOW', 'SPLK'] },
      { name: 'Streaming', tickers: ['ROKU', 'NFLX', 'DIS', 'SPOT', 'PARA'] },
      { name: 'Connected Fitness', tickers: ['PTON', 'LULU', 'NKE', 'UAA', 'WW'] },
      { name: 'Telemedicine', tickers: ['TDOC', 'AMWL', 'DOCS', 'HIMS', 'ONEM'] },
    ],
  },
  {
    name: 'EV + Clean Energy 2020',
    description: 'Tesla supercycle and solar/battery breakouts on massive volume',
    groups: [
      { name: 'EV OEMs', tickers: ['TSLA', 'NIO', 'LI', 'XPEV', 'RIVN'] },
      { name: 'Solar', tickers: ['ENPH', 'SEDG', 'RUN', 'FSLR', 'ARRY'] },
      { name: 'Hydrogen/Fuel Cells', tickers: ['PLUG', 'BE', 'FCEL', 'BLDP', 'NKLA'] },
    ],
  },
  {
    name: 'E-commerce Fintech 2020',
    description: 'Pandemic accelerated digital commerce and payments adoption',
    groups: [
      { name: 'Marketplaces', tickers: ['ETSY', 'SE', 'MELI', 'SHOP', 'AMZN'] },
      { name: 'Payments', tickers: ['SQ', 'PYPL', 'AFRM', 'FOUR', 'TOST'] },
      { name: 'Logistics', tickers: ['FDX', 'UPS', 'CHRW', 'EXPD', 'XPO'] },
    ],
  },

  // ═══════════════════════ 2021 ═══════════════════════
  {
    name: 'Commodities Supercycle 2021',
    description: 'Reopening inflation, supply chain squeeze, commodity price surge',
    groups: [
      { name: 'Oil E&P', tickers: ['DVN', 'OXY', 'FANG', 'EOG', 'APA'] },
      { name: 'Steel/Metals', tickers: ['CLF', 'NUE', 'STLD', 'X', 'AA'] },
      { name: 'Shipping', tickers: ['ZIM', 'DAC', 'GNK', 'SBLK', 'CMRE'] },
      { name: 'Coal', tickers: ['ARCH', 'CEIX', 'BTU', 'AMR', 'HCC'] },
    ],
  },
  {
    name: 'Lithium + Battery 2021',
    description: 'EV demand pull-through driving lithium miners to multi-bagger runs',
    groups: [
      { name: 'Miners', tickers: ['LAC', 'SLI', 'SGML', 'ALB', 'SQM'] },
      { name: 'Processors', tickers: ['ALB', 'LTHM', 'SQM', 'ALTM', 'PLL'] },
    ],
  },
  {
    name: 'Reopening Trade 2021',
    description: 'Consumer recovery plays as economies reopen from COVID',
    groups: [
      { name: 'Auto', tickers: ['F', 'GM', 'TSLA', 'STLA', 'RACE'] },
      { name: 'Travel', tickers: ['ABNB', 'CCL', 'RCL', 'NCLH', 'BKNG'] },
      { name: 'Delivery', tickers: ['DASH', 'UBER', 'LYFT', 'CART', 'OLO'] },
      { name: 'Biotech', tickers: ['MRNA', 'BNTX', 'NVAX', 'REGN', 'VRTX'] },
    ],
  },

  // ═══════════════════════ 2022 ═══════════════════════
  {
    name: 'Oil Gas Supercycle 2022',
    description: 'Russia/Ukraine war and OPEC cuts driving energy to decade highs',
    groups: [
      { name: 'E&P', tickers: ['OXY', 'FANG', 'CTRA', 'DVN', 'EOG'] },
      { name: 'Natural Gas', tickers: ['AR', 'EQT', 'CTRA', 'LNG', 'RRC'] },
      { name: 'Integrated', tickers: ['XOM', 'CVX', 'COP', 'SHEL', 'BP'] },
      { name: 'Refining', tickers: ['MPC', 'VLO', 'PSX', 'DINO', 'PBF'] },
    ],
  },
  {
    name: 'Coal NatGas Crisis 2022',
    description: 'European energy crisis driving coal and nuclear utility stocks',
    groups: [
      { name: 'Coal Producers', tickers: ['CEIX', 'ARCH', 'BTU', 'AMR', 'HCC'] },
      { name: 'Nuclear Utility', tickers: ['CEG', 'VST', 'TLN', 'NEE', 'DUK'] },
    ],
  },
  {
    name: 'Defense 2022',
    description: 'Geopolitical escalation driving defense spending and rearmament',
    groups: [
      { name: 'Defense Primes', tickers: ['LMT', 'NOC', 'GD', 'RTX', 'BA'] },
      { name: 'Defense IT', tickers: ['LDOS', 'SAIC', 'CACI', 'BAH', 'PLTR'] },
    ],
  },

  // ═══════════════════════ 2023 ═══════════════════════
  {
    name: 'AI Infrastructure 2023',
    description: 'GPU and data center buildout wave 1 driven by ChatGPT explosion',
    groups: [
      { name: 'AI Chips', tickers: ['NVDA', 'AMD', 'AVGO', 'MRVL', 'ARM'] },
      { name: 'AI Servers', tickers: ['SMCI', 'DELL', 'HPE', 'NTAP', 'WDC'] },
      { name: 'Networking', tickers: ['ANET', 'CSCO', 'JNPR', 'CIEN', 'NTNX'] },
      { name: 'Cooling/Power', tickers: ['VRT', 'ETN', 'GEV', 'GNRC', 'ST'] },
    ],
  },
  {
    name: 'AI Software Platforms 2023',
    description: 'LLM and GenAI monetization driving AI software to breakouts',
    groups: [
      { name: 'AI Analytics', tickers: ['PLTR', 'SNOW', 'DDOG', 'AI', 'MDB'] },
      { name: 'Security', tickers: ['CRWD', 'PANW', 'ZS', 'FTNT', 'OKTA'] },
      { name: 'Enterprise AI', tickers: ['NOW', 'SNOW', 'DDOG', 'MSFT', 'CRM'] },
    ],
  },
  {
    name: 'Crypto Recovery 2023',
    description: 'Bitcoin halving pre-run and crypto exchange recovery',
    groups: [
      { name: 'Exchanges', tickers: ['COIN', 'HOOD', 'IBKR', 'CME', 'SCHW'] },
      { name: 'Mining', tickers: ['MARA', 'RIOT', 'CLSK', 'CIFR', 'WULF'] },
      { name: 'Bitcoin Proxy', tickers: ['MSTR', 'HUT', 'BTBT', 'IREN', 'CORZ'] },
    ],
  },

  // ═══════════════════════ 2024 ═══════════════════════
  {
    name: 'AI Power Nuclear 2024',
    description: 'Data center electricity demand driving nuclear and IPP stocks',
    groups: [
      { name: 'Nuclear', tickers: ['CEG', 'OKLO', 'NNE', 'SMR', 'LEU'] },
      { name: 'Power Generation', tickers: ['VST', 'TLN', 'NRG', 'CEG', 'NEE'] },
      { name: 'Grid/Equipment', tickers: ['GEV', 'ETN', 'EMR', 'ROK', 'HUBB'] },
    ],
  },
  {
    name: 'AI Infra Wave 2 2024',
    description: 'Picks-and-shovels deepening with software monetization and edge AI',
    groups: [
      { name: 'AI Chips', tickers: ['NVDA', 'AVGO', 'AMD', 'MRVL', 'ARM'] },
      { name: 'Software Monetization', tickers: ['APP', 'PLTR', 'META', 'GOOGL', 'MSFT'] },
      { name: 'Networking', tickers: ['ANET', 'CSCO', 'JNPR', 'CIEN', 'NTNX'] },
      { name: 'Cooling', tickers: ['VRT', 'ETN', 'GEV', 'HUBB', 'ST'] },
      { name: 'Public Safety AI', tickers: ['AXON', 'MSFT', 'PLTR', 'LDOS', 'SAIC'] },
    ],
  },
  {
    name: 'Quantum Computing 2024',
    description: 'Speculative quantum theme emerging late 2024 with extreme volume',
    groups: [
      { name: 'Pure-play Quantum', tickers: ['RGTI', 'IONQ', 'QBTS', 'QUBT', 'ARQQ'] },
      { name: 'Quantum Annealing', tickers: ['QBTS', 'RGTI', 'IONQ', 'QUBT', 'ARQQ'] },
    ],
  },

  // ═══════════════════════ 2025 ═══════════════════════
  {
    name: 'AI Agents Software 2025',
    description: 'Next wave of AI monetization through autonomous agents and automation',
    groups: [
      { name: 'AI Platforms', tickers: ['PLTR', 'NOW', 'MSFT', 'GOOGL', 'META'] },
      { name: 'Security', tickers: ['CRWD', 'FTNT', 'PANW', 'ZS', 'OKTA'] },
      { name: 'Automation', tickers: ['AXON', 'PATH', 'APP', 'CRM', 'NOW'] },
    ],
  },
  {
    name: 'Defense Aerospace 2025',
    description: 'Global rearmament and increased defense budgets worldwide',
    groups: [
      { name: 'Primes', tickers: ['LMT', 'GD', 'NOC', 'RTX', 'BA'] },
      { name: 'Defense IT/Cyber', tickers: ['LDOS', 'PLTR', 'SAIC', 'CACI', 'BAH'] },
      { name: 'Public Safety', tickers: ['AXON', 'MSFT', 'PLTR', 'LDOS', 'SAIC'] },
    ],
  },
];
