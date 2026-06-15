# Implementation Roadmap

## Goal

Build Alphaboard into a lightweight research operating system:

```text
yfinance provides price data.
Program calculates objective market/setup facts.
LLM web search enriches selected leaders, themes, supply-chain mapping, news, and catalysts.
Cheap dataframe review ranks candidates.
Visual model reviews only selected group galleries and finalist charts.
Frontend shows tables and reports.
```

The frontend does not need to be chart-heavy. It should mainly show focus lists, setup tables, daily updates, market condition, and generated reports.

## Build Principles

- Do not fetch all stocks every day.
- Do full scans only twice per week.
- On normal trading days, update only focus-list stocks.
- Use yfinance for now.
- Keep provider routing so paid data providers can be added later.
- Run setup detection only on the filtered tradable universe.
- Prefer false positives over false negatives in first-pass setup detection.
- Use web search only for selected leaders/groups/candidates, not every ticker.
- Use visual models only for group galleries and individual finalists.
- Store run timing and model cost estimates in `ScanRun`.

## Phase 1: Data Provider Router

Create a routing layer even though yfinance is the only active provider for now.

Files to add:

```text
backend/src/modules/data-ingestion/providers/provider.types.ts
backend/src/modules/data-ingestion/providers/market-data-router.service.ts
```

Responsibilities:

- route daily bar requests to yfinance
- expose one interface for future EODHD, Polygon, Alpaca, or other providers
- record provider source in logs and future metadata
- support fallback behavior later

Suggested interface:

```ts
interface MarketDataRouter {
  fetchDailyBars(ticker: string, from: Date, to: Date): Promise<DailyBarData[]>;
  fetchIntradayBars?(ticker: string, date: Date, interval: string): Promise<IntradayBarData[]>;
}
```

Registration:

- add `MarketDataRouterService` to `DataIngestionModule.providers`
- export it from `DataIngestionModule`
- keep `YFinanceProvider` registered as the active provider

## Phase 2: ScanRun And Timing

Add `ScanRun` so every pipeline step can be measured.

Prisma model:

```text
ScanRun
- id
- type                    // FULL_SCAN, FOCUS_UPDATE, MODEL_REVIEW, VISUAL_REVIEW
- status                  // RUNNING, COMPLETED, FAILED
- startedAt
- finishedAt
- durationMs
- stockCount
- candidateCount
- focusListCount
- modelInputTokens
- modelOutputTokens
- modelCostEstimate
- stepTimingsJson
- error
- notes
```

Implementation:

- create `ScanRunService`
- wrap each pipeline step with timing
- store counts for fetched stocks, candidates, model-reviewed items, focus-list items

Use this to identify bottlenecks before optimizing.

## Phase 3: Research Module

Add one orchestration module:

```text
backend/src/modules/research/research.module.ts
backend/src/modules/research/research.controller.ts
backend/src/modules/research/scan-run.service.ts
backend/src/modules/research/full-scan.service.ts
backend/src/modules/research/focus-list.service.ts
backend/src/modules/research/daily-update.service.ts
backend/src/modules/research/strategy-report.service.ts
backend/src/modules/research/model-review.service.ts
backend/src/modules/research/catalyst-hypothesis.service.ts
```

Register `ResearchModule` in:

```text
backend/src/app.module.ts
```

This module should coordinate existing services rather than duplicating them:

- `PipelineService`
- `SetupOrchestratorService`
- `MarketRegimeService`
- `BreadthService`
- `ThemeService`
- `StockService`
- future model providers

## Phase 4: Universe Filtering

Create a service that decides which tickers can enter setup detection.

Rules:

- price above threshold, normally `$10`
- average volume above threshold, normally `1M`
- current Stage 2 stocks
- previous market leaders, regardless of whether they are still Stage 2
- previous leaders that are not Stage 4, unless specifically needed for bearish review
- gold, silver, copper, uranium, raw materials, and commodity-related stocks
- important indexes and ETFs
- manually pinned tickers

Files:

```text
backend/src/modules/research/universe-filter.service.ts
```

Output:

```text
TradableUniverseCandidate
- stockId
- ticker
- reasonCodes
- stage
- isPreviousLeader
- isCurrentLeader
- isCommodityRelated
- liquidityPass
- pricePass
```

Use this service before setup detection.

## Phase 5: Leader And Theme Metadata Enrichment

Use LLM web search only when a ticker or group is worth enriching:

- current leader
- previous leader
- good technical setup
- group is synchronized
- catalyst hypothesis is relevant
- manually requested

Do not enrich all tickers.

Tables to add or amend:

```text
Stock
- briefDescription
- tradableType
- isTradable
```

```text
TickerThemeMembership
- stockId
- themeId
- supplyChainSegmentId
- roleDescription
- importanceScore
- isPrimaryTheme
- source
- reviewedAt
```

```text
SupplyChainSegment
- themeId
- name
- sortOrder
```

```text
GroupRelationship
- sourceGroupId
- targetGroupId
- relationshipType
- macroSensitivity
- strengthScore
- lagDaysEstimate
- source
- notes
```

Metadata enrichment workflow:

```text
1. Full scan identifies leaders/candidates/groups.
2. Select tickers/groups lacking metadata.
3. LLM web search gathers public company description, industry, theme, supply-chain role.
4. Store result with source URLs and reviewedAt.
5. User can later correct mappings manually.
```

Metadata prompt should ask for structured JSON only:

```json
{
  "ticker": "EXAMPLE",
  "briefDescription": "...",
  "industry": "...",
  "themes": [
    {
      "theme": "AI Infrastructure",
      "supplyChainSegment": "Networking",
      "roleDescription": "...",
      "importanceScore": 0.8
    }
  ],
  "relatedGroups": [
    {
      "relationshipType": "SUPPLIER_TO",
      "targetGroup": "Data Centers",
      "notes": "..."
    }
  ],
  "sources": []
}
```

## Phase 6: Catalyst Hypothesis Workflow

Use LLM web search for selected groups/themes after the scanner finds technical interest.

Trigger catalyst search when:

- group gallery shows synchronization
- multiple leaders in a group are near key levels
- setup count spikes in a group
- previous leaders in one theme begin reclaiming levels
- market condition favors that setup family
- user requests a theme check

Prisma model:

```text
CatalystHypothesis
- id
- createdAt
- themeId
- groupId
- title
- sourceUrlsJson
- hypothesis
- expectedBeneficiariesJson
- expectedLosersJson
- technicalVerificationJson
- status                  // WATCHING, CONFIRMED, REJECTED, STALE
- confidenceScore
```

Workflow:

```text
1. Program finds a technically interesting group.
2. LLM web search finds likely catalysts.
3. Model forms hypothesis.
4. Program verifies with technical evidence.
5. Report states whether price confirms or rejects the hypothesis.
```

Example:

```text
Hypothesis:
Uranium supply/news supports the uranium group.

Technical verification:
URA/URNM improving, CCJ/NXE/DNN near key levels, volume improving, group breadth rising.

Result:
Confirmed / Watch / Rejected.
```

## Phase 7: Loose Setup Candidate Detection

Keep the first pass loose.

Add:

```text
backend/src/modules/setup/key-level-candidate.service.ts
backend/src/modules/setup/loose-setup-candidate.service.ts
```

Detect:

- near swing high
- near swing low
- near 20EMA, 50MA, 150MA, 200MA
- near base high/low
- near prior pivot
- price reclaim or rejection
- volume expansion/contraction near key level

Loose labels:

- possible pullback
- possible U&R
- possible double top
- possible double bottom
- possible VCP
- possible failed breakout
- possible base
- possible intraday double top
- possible intraday double bottom
- possible intraday base
- possible intraday U&R
- possible VWAP reclaim/rejection

Priority:

```text
daily setup > group/market context > intraday setup > 620 readiness
```

## Phase 8: Focus List

Create weekly/midweek focus lists from full scans.

Models:

```text
FocusList
- id
- name
- type                    // WEEKLY, MIDWEEK, THEME, MANUAL
- createdAt
- expiresAt
- sourceScanRunId
- marketConditionSnapshotId
- notes
```

```text
FocusListItem
- id
- focusListId
- stockId
- themeId
- groupId
- reason
- priorityScore
- setupBias
- expectedSetupTypesJson
- keyLevelsJson
- invalidationLevelsJson
- catalystHypothesisId
- focusToday
- focusTodayReason
- status                  // ACTIVE, TRIGGERED, VIOLATED, EXPIRED, REMOVED
- addedAt
- lastReviewedAt
```

Focus list entry reasons:

- strong daily setup
- group synchronized
- catalyst hypothesis
- current leader
- previous leader near key level
- reversal candidate near 620 monitoring zone
- manual pin

## Phase 9: Daily Focus Update

Normal trading days only update focus-list stocks.

Daily update steps:

```text
1. Fetch focus-list tickers with yfinance.
2. Update indicators and key-level distances.
3. Reconfirm daily setup quality.
4. Check group synchronization using dataframe metrics.
5. Check market condition support.
6. Check intraday setup structure when intraday data exists.
7. Decide focusToday true or false.
8. Decide if 620 readiness monitoring is needed.
9. Generate daily report.
```

Daily report must answer:

- what should be focused today?
- what is actionable versus monitor-only?
- what triggered?
- what violated?
- which group is still synchronized?
- what changed in market condition?
- which reversal candidates should be watched for 620 readiness?
- what exit updates are needed?

## Phase 10: 620 Reversal Readiness

620 is a readiness alert, not an entry command.

Only monitor 620 when:

- ticker is on focus list
- `focusToday = true`
- reversal setup context exists
- daily setup quality is good enough
- intraday setup is forming or formed
- price is near planned key level

Readiness states:

```text
NOT_RELEVANT
WATCHING
TESTING_LEVEL
COMPRESSING
ALMOST_READY
READY_TO_CONFIRM
CROSSED
FAILED
STALE
```

Implement in:

```text
backend/src/modules/setup/reversal-620-readiness.service.ts
```

Update existing `IntradayTimingSignal` or add fields for readiness state.

## Phase 11: Market Condition Snapshot

Add boolean flags plus scores.

Model:

```text
MarketConditionSnapshot
- date
- scopeType
- scopeKey
- longTermTrendingUp
- longTermTrendingDown
- longTermRanging
- longTermRangeHigh
- longTermRangeLow
- midTermTrendingUp
- midTermTrendingDown
- midTermRanging
- midTermExtended
- midTermPullback
- shortTermTrendingUp
- shortTermTrendingDown
- shortTermRanging
- shortTermExtended
- shortTermOversold
- breadthConfirming
- breadthDiverging
- breadthImproving
- breadthDeteriorating
- leadersAdvancing
- leadersBasing
- leadersFailing
- leadersExtended
- leadersRotating
- easyMoney
- quickRotation
- hardPenny
- distribution
- earlyRecovery
- breakoutFavorable
- pullbackFavorable
- reversalFavorable
- shortFavorable
- holdLongerFavorable
- scalpOnly
- stayOut
- waterTest
- normalExposure
- aggressiveExposure
- marginAllowed
- trendScore
- breadthScore
- leaderScore
- followThroughScore
- riskScore
- confidenceScore
- evidenceJson
- summary
```

Market condition should be calculated for:

- QQQ/SPY/IWM/DIA
- leader universe
- tradable universe
- important themes/groups

## Phase 12: Model Review Layer

Add provider interface:

```text
backend/src/modules/research/model-providers/model-review-provider.interface.ts
backend/src/modules/research/model-providers/llm-web-search.provider.ts
backend/src/modules/research/model-providers/qwen-vision.provider.ts
backend/src/modules/research/model-providers/deepseek-text.provider.ts
```

Initial behavior can be manual/mock until API keys are configured.

Responsibilities:

- dataframe candidate review
- ticker metadata enrichment by web search
- catalyst hypothesis by web search
- group gallery visual review
- individual chart visual review
- strategy report summarization

Always store:

- prompt type
- model name
- input token estimate
- output token estimate
- cost estimate
- result JSON
- createdAt

Table:

```text
ModelReview
- id
- scanRunId
- reviewType
- provider
- model
- inputTokens
- outputTokens
- costEstimate
- targetType
- targetId
- resultJson
- createdAt
```

## Phase 13: Visual Review Artifacts

Reuse the existing Python review/chart export idea, but make it serve the research workflow.

Generate:

- group gallery images
- individual finalist chart images
- optional HTML chart artifacts

Use visual model for:

- group synchronization
- chart pattern recognition
- trendline/wedge recognition
- head and shoulders
- double top/bottom
- VCP cleanliness
- failed breakout shape

Do not run visual review every day by default.

## Phase 14: Strategy Recommendations And Outcomes

Store what the system suggested so performance can be measured.

```text
StrategyRecommendation
- id
- date
- stockId
- themeId
- groupId
- setupType
- direction
- entryZoneJson
- stopLevel
- targetLevelsJson
- exitPlanJson
- thesis
- catalystHypothesisId
- marketConditionSnapshotId
- confidenceScore
- exposureMode
```

```text
RecommendationOutcome
- id
- recommendationId
- maxR
- maxPctMove
- finalR
- daysToMaxR
- stoppedOut
- targetHit
- setupViolated
- bestExitSignal
- notes
```

Reports should use this to answer:

- should we stay out?
- should we water test?
- should we use normal size?
- should we press?
- what setup is actually working now?
- what exit style has worked recently?

## Phase 15: Lightweight Frontend

The frontend should be table/report first.

Pages:

```text
/research-report
/focus-list
/daily-update
/market-condition
/catalysts
```

Important tables:

```text
Focus Today
- ticker
- group
- setup
- daily quality
- intraday structure
- 620 readiness
- key level
- action
- reason
```

```text
Group Focus
- group/theme
- sync score
- setup count
- working setup
- catalyst
- report status
- next action
```

```text
Market Condition
- scope
- long/mid/short condition flags
- breadth flags
- leader flags
- favorable setup family
- exposure recommendation
```

Charts are optional:

- link to generated gallery image
- link to individual review chart
- no need for heavy interactive charting at first

## Phase 16: API Endpoints

Research:

```text
POST /research/full-scan
POST /research/focus-update
GET /research/latest-report
GET /research/daily-update
GET /research/focus-list/current
GET /research/scan-runs
GET /research/catalysts
```

Market:

```text
GET /market/condition/latest
GET /market/condition/history
```

Setup:

```text
GET /setups/candidates
GET /setups/intraday-readiness
GET /setups/620-readiness
```

Admin/manual:

```text
POST /research/focus-list/manual-add
POST /research/metadata/enrich
POST /research/catalyst/search
POST /research/model-review/run
```

## Recommended Build Order

1. Add `ScanRun` and timing wrappers.
2. Add provider router with yfinance as active provider.
3. Add `ResearchModule`.
4. Add universe filter for setup detection.
5. Add focus-list tables and services.
6. Add daily focus update.
7. Add loose setup/key-level candidate services.
8. Add market condition snapshot table and service.
9. Add ticker/theme/supply-chain metadata enrichment workflow.
10. Add catalyst hypothesis workflow.
11. Add lightweight frontend pages for focus list, daily update, and reports.
12. Add model review storage and provider interface.
13. Add visual gallery and individual chart review artifacts.
14. Add recommendation/outcome tracking.
15. Tune performance using `ScanRun.stepTimingsJson`.

## MVP Definition

The first useful version should do this:

```text
Sunday/Wednesday:
run full yfinance scan
filter tradable universe
calculate breadth and market condition
run loose setup detection
create focus list
use web search on selected leaders/groups for metadata/catalysts
produce report

Other trading days:
update focus-list stocks only
decide focusToday
show daily table/report
```

This MVP does not require:

- paid data provider
- heavy frontend charting
- daily visual model
- automatic trading
- perfect setup detection

## Success Criteria

The system is working when it can answer:

- what group should I focus this week?
- what stock should I focus today?
- what setup is working now?
- what market condition are we in?
- is this market good for holding, scalping, reversal, breakout, or staying out?
- what catalyst hypothesis is being confirmed or rejected?
- what did last week's suggestions do?
- should I reduce, water test, trade normal size, or press?
