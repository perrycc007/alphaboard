# Strategy Intelligence Workflow

## Goal

Alphaboard is not only a website or chart scanner. It is a trading intelligence system that reduces the market into a small number of actionable decisions.

The system should:

- filter the stock universe aggressively before setup detection
- calculate objective market facts in code
- run loose setup detection to avoid false negatives
- use cheap models for structured dataframe review
- use visual models mainly for chart-pattern and trendline recognition
- track whether prior recommendations actually worked
- recommend which groups, setups, and exposure modes fit the current market

## High-Level Funnel

```text
Data ingestion
-> universe filtering
-> market condition and breadth calculation
-> catalyst/theme hypothesis
-> loose key-level setup detection
-> structured dataframe review
-> group gallery visual review
-> individual chart + dataframe deep review
-> final strategy report
-> outcome tracking and feedback
```

## Signal Priority

Use this hierarchy whenever signals conflict:

```text
1. Daily setup quality and location
2. Group/theme context and market condition
3. Intraday setup structure
4. 620 reversal readiness
```

A good daily setup is more important than an intraday setup. A good intraday setup is more important than a 620 cross or near-cross.

620 should only help time or monitor an already valid reversal idea. It should not override weak daily structure or missing group context.

## Full Scan Schedule

Full scans run twice per week:

- Sunday Hong Kong time, after Friday US close
- Wednesday after US market close, usually Thursday Hong Kong time

Full scans:

- fetch all tradable stocks
- update all indicators and stages
- update leader status
- calculate market breadth
- refresh market condition snapshots
- run loose setup detection
- update focus lists
- run group gallery visual review
- run selected individual deep reviews
- produce weekly or midweek strategy report

## Normal Trading Day Schedule

On other trading days, do not fetch and review the whole market.

Normal days only update:

- focus-list stocks
- major indexes and ETFs
- active theme/group proxies
- market breadth if internally calculated
- AAII sentiment only when new data is available

Normal-day output should answer:

- should this stock be a focus today?
- did any setup trigger?
- did any setup violate?
- did the group stay synchronized?
- did market condition improve or deteriorate?
- should exposure change?
- should the stock remain on the focus list?

## Universe Filter

Only pass these into setup detection:

- liquid stocks, normally average volume above 1M
- price above minimum tradable threshold, normally $10
- current Stage 2 stocks
- previous market leaders, even if they are still Stage 2
- previous market leaders in Stage 3 or other non-Stage-4 conditions
- gold, silver, copper, uranium, raw material, and commodity-related stocks
- important indexes and ETFs

Low-volume stocks should be ignored unless manually added.

## Breadth Data

Prefer calculating breadth internally when enough data exists:

- NAA50R: percent of Nasdaq stocks above 50MA
- NAA200R: percent of Nasdaq stocks above 200MA
- NAAD: Nasdaq advancers minus decliners
- NAHL: Nasdaq new highs minus new lows

If the system only has the tradable/focus universe, label the output clearly:

- leader breadth
- tradable universe breadth
- theme breadth
- group breadth

Do not confuse these with full Nasdaq breadth.

If breadth can be calculated internally, web scraping is not needed for breadth. AAII sentiment may still be scraped from public sources when allowed.

## Catalyst Hypothesis Layer

Before final technical review, find catalyst hypotheses that may affect a theme, group, industry, or supply chain.

Examples:

- AI infrastructure capex may benefit semiconductors, networking, power, cooling, and data center stocks.
- Uranium policy or supply news may benefit miners, ETFs, and fuel-cycle names.
- Gold, silver, copper, and raw material moves may affect miners, producers, equipment names, and related ETFs.

For each hypothesis, technical behavior must verify or reject it:

- are related stocks moving together?
- are leaders confirming?
- is the group basing, breaking out, or hitting resistance together?
- is volume confirming?
- is breadth inside the group improving?

## Final Report

The final report should include:

- overall market condition
- whether the current market fits the strategy
- what setup is working now
- which groups are synchronized
- which group to focus this week
- which group to monitor next month
- specific tickers to trade or watch
- setup to wait for
- entry area, invalidation, target, and exit plan
- red flags and divergences
- catalyst hypothesis and technical result
- similar historical period and how it developed
- recommended exposure: stay out, water test, normal, aggressive, or margin allowed

The report must suggest specific tickers, not only themes.
