# Market Leaders (Stage 2 At Least Once) Since 2019

## What You Asked For
- At least 3 names for each theme and each period
- Avoid obvious mega-cap crowd names
- Focus on names swing traders actually rotate into
- Different periods should have their own leaders

This file is built as a **swing-trader leader map by period**.  
All names below are **non-mega-cap biased** and treated as **Stage 2 candidates** (must still be template-validated in your scan).

---

## Stage 2 Filter (from your spec)

Use these checks before execution:
- `Price > 20MA > 50MA > 200MA`
- 20/50/200 MA slopes up
- RS vs index rising
- Base / pivot / continuation structure present

---

## 2019 Leaders (Pre-COVID Growth + Clean Energy)

### Theme: Solar / Clean Energy
- `ENPH` (Enphase Energy)
- `SEDG` (SolarEdge)
- `RUN` (Sunrun)

### Theme: Cloud / SaaS Momentum
- `TWLO` (Twilio)
- `OKTA` (Okta)
- `MDB` (MongoDB)

### Theme: Internet / Platform Momentum
- `ROKU` (Roku)
- `PINS` (Pinterest)
- `ETSY` (Etsy)

---

## 2020 Leaders (Pandemic Winners + EV/Green Mania)

### Theme: Work-from-Home / Software
- `ZM` (Zoom)
- `DDOG` (Datadog)
- `CRWD` (CrowdStrike)

### Theme: EV Beta (non-mega)
- `NIO` (NIO)
- `XPEV` (XPeng)
- `LI` (Li Auto)

### Theme: Clean Energy / Solar Beta
- `ENPH` (Enphase Energy)
- `RUN` (Sunrun)
- `PLUG` (Plug Power)

---

## 2021 Leaders (Reflation / Commodity / Cyclical)

### Theme: Oil & Gas E&P
- `DVN` (Devon Energy)
- `MRO` (Marathon Oil)
- `FANG` (Diamondback Energy)

### Theme: Fertilizer / Agriculture Inputs
- `CF` (CF Industries)
- `MOS` (Mosaic)
- `NTR` (Nutrien)

### Theme: Shipping / Freight
- `ZIM` (ZIM Integrated Shipping)
- `DAC` (Danaos)
- `GSL` (Global Ship Lease)

---

## 2022 Leaders (Bear-Market Relative Strength)

### Theme: Energy Survivors
- `AR` (Antero Resources)
- `HES` (Hess)
- `MUR` (Murphy Oil)

### Theme: Coal / Thermal Supply Shock
- `BTU` (Peabody)
- `ARCH` (Arch Resources)
- `CEIX` (Consol Energy)

### Theme: Defense / Aerospace
- `AVAV` (AeroVironment)
- `KTOS` (Kratos Defense)
- `HII` (Huntington Ingalls)

---

## 2023 Leaders (AI Expansion, But Not Just Mega-Cap AI)

### Theme: AI Infrastructure (2nd-line leaders)
- `SMCI` (Super Micro Computer)
- `ANET` (Arista Networks)
- `MU` (Micron)

### Theme: AI Software / Data Platforms
- `PLTR` (Palantir)
- `AI` (C3.ai)
- `SNOW` (Snowflake)

### Theme: Cybersecurity
- `CRWD` (CrowdStrike)
- `ZS` (Zscaler)
- `FTNT` (Fortinet)

---

## 2024 Leaders (Power Constraint + Non-Consensus Momentum)

### Theme: Power / Grid / Electrification
- `VRT` (Vertiv)
- `ETN` (Eaton)
- `HUBB` (Hubbell)

### Theme: Utilities / Nuclear-Linked Demand
- `VST` (Vistra)
- `CEG` (Constellation Energy)
- `TLN` (Talen Energy)

### Theme: Crypto Proxy (Equity Beta)
- `MSTR` (MicroStrategy)
- `COIN` (Coinbase)
- `CLSK` (CleanSpark)

---

## 2025 Leaders (AI Power Stack + Defense Tech + Uranium)

### Theme: AI Power Stack Continuation
- `VRT` (Vertiv)
- `PWR` (Quanta Services)
- `NVT` (nVent)

### Theme: Defense / Drone / Security Tech
- `AVAV` (AeroVironment)
- `KTOS` (Kratos Defense)
- `PLTR` (Palantir)

### Theme: Uranium / Nuclear Fuel Cycle
- `CCJ` (Cameco)
- `UEC` (Uranium Energy Corp)
- `LEU` (Centrus Energy)

---

## Notes for Your Pipeline

- Add `leader_period_tag`: `2019`, `2020`, ..., `2025`
- Add `theme_tag`: one of the themes above
- Add `was_stage2_in_period` boolean
- Keep a rolling `current_stage2` boolean for live scan

---

## Internet Research Sources (used for theme validation)

1. Visual Capitalist - Ranking the Top S&P 500 Stocks by 5-Year Returns  
   https://www.visualcapitalist.com/top-sp-500-stocks-return/
2. Nasdaq - clean energy / yearly top performer roundups  
   https://www.nasdaq.com/
3. CNBC / BusinessInsider / Morningstar year-specific winners coverage  
   https://www.cnbc.com/  
   https://markets.businessinsider.com/  
   https://www.morningstar.com/
4. MacroTrends historical stock tables for spot verification  
   https://www.macrotrends.net/

---

## All Tickers Array

```js
[
  "ENPH", "SEDG", "RUN", "TWLO", "OKTA", "MDB", "ROKU", "PINS", "ETSY",
  "ZM", "DDOG", "CRWD", "NIO", "XPEV", "LI", "PLUG", "DVN", "MRO", "FANG",
  "CF", "MOS", "NTR", "ZIM", "DAC", "GSL", "AR", "HES", "MUR", "BTU",
  "ARCH", "CEIX", "AVAV", "KTOS", "HII", "SMCI", "ANET", "MU", "PLTR",
  "AI", "SNOW", "ZS", "FTNT", "VRT", "ETN", "HUBB", "VST", "CEG", "TLN",
  "MSTR", "COIN", "CLSK", "PWR", "NVT", "CCJ", "UEC", "LEU", "QQQ", "GLD",
  "SLV"
]
```
