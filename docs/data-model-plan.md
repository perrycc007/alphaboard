# Data Model Plan

## Leader Status

Previous leader should be stored separately from current stage.

A stock can be:

- current Stage 2 and previous leader
- current Stage 2 and new leader
- Stage 3 and previous leader
- Stage 4 and broken former leader

Do not define previous leader only by current stage. Store historical leader runs.

## Ticker Master

Store all tracked tickers and their classification.

```text
TickerMaster
- id
- ticker
- name
- briefDescription
- exchange
- sector
- industry
- avgVolume
- marketCap
- tradableType              // STOCK, ETF, INDEX, COMMODITY_PROXY
- isActive
- isTradable
```

## Theme And Supply Chain

Store theme membership and where each ticker sits in a supply chain.

```text
Theme
- id
- name
- description
- isActive
```

```text
SupplyChainSegment
- id
- themeId
- name                      // upstream, producer, equipment, platform, downstream
- sortOrder
```

```text
TickerThemeMembership
- id
- tickerId
- themeId
- supplyChainSegmentId
- roleDescription
- importanceScore
- isPrimaryTheme
```

## Group Relationships

Store how industries, themes, and supply-chain groups affect each other.

```text
GroupRelationship
- id
- sourceGroupId
- targetGroupId
- relationshipType          // LEADS, LAGS, BENEFITS, HURTS, COMPETES, SUPPLIER_TO
- macroSensitivity          // RATES, DOLLAR, OIL, COPPER, GOLD, YIELDS, INFLATION
- strengthScore
- lagDaysEstimate
- notes
```

Examples:

- semiconductors may lead AI software
- copper miners may lead industrial material equipment
- rising yields may hurt long-duration software
- gold may support gold miners, but miners must confirm technically

## Focus List

The focus list is the bridge between twice-weekly full scans and normal-day monitoring.

```text
FocusList
- id
- name
- type                      // WEEKLY, MIDWEEK, THEME, MANUAL
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
- setupBias                 // LONG, SHORT, BOTH, WATCH
- expectedSetupTypesJson
- keyLevelsJson
- invalidationLevelsJson
- catalystHypothesisId
- focusToday                // daily update writes this
- focusTodayReason
- status                    // ACTIVE, TRIGGERED, VIOLATED, EXPIRED, REMOVED
- addedAt
- lastReviewedAt
```

## Catalyst Hypothesis

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
- status                    // WATCHING, CONFIRMED, REJECTED, STALE
- confidenceScore
```

## Recommendation And Outcome Tracking

Store every suggested trade/watch idea so performance can be reviewed.

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
- exposureMode              // STAY_OUT, WATER_TEST, NORMAL, AGGRESSIVE, MARGIN_ALLOWED
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

## Scan Run

```text
ScanRun
- id
- type                      // FULL_SCAN, FOCUS_UPDATE
- startedAt
- finishedAt
- stockCount
- candidateCount
- focusListCount
- modelCostEstimate
- notes
```
