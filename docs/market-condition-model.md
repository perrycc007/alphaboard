# Market Condition Model

## Principle

Market condition should not be stored as one category. A market can be long-term ranging while mid-term trending and short-term extended. Store market condition as boolean factors plus numeric scores.

Example:

```text
longTermRanging = true
midTermTrendingUp = true
shortTermExtended = true
breadthDiverging = true
quickRotation = true
breakoutFavorable = false
reversalFavorable = true
```

## Snapshot Scope

Create market condition snapshots for multiple scopes:

- NASDAQ
- SP500
- leader universe
- tradable universe
- theme
- industry
- supply-chain group
- specific ETF proxy

## Proposed MarketConditionSnapshot Fields

One row per date and scope.

```text
id
date
scopeType              // INDEX, UNIVERSE, THEME, INDUSTRY, GROUP, ETF
scopeKey               // QQQ, NASDAQ, AI, SEMI, URANIUM

longTermTrendingUp
longTermTrendingDown
longTermRanging
longTermRangeHigh
longTermRangeLow

midTermTrendingUp
midTermTrendingDown
midTermRanging
midTermExtended
midTermPullback

shortTermTrendingUp
shortTermTrendingDown
shortTermRanging
shortTermExtended
shortTermOversold

breadthConfirming
breadthDiverging
breadthImproving
breadthDeteriorating

leadersAdvancing
leadersBasing
leadersFailing
leadersExtended
leadersRotating

easyMoney
quickRotation
hardPenny
distribution
earlyRecovery

breakoutFavorable
pullbackFavorable
reversalFavorable
shortFavorable
holdLongerFavorable
scalpOnly

stayOut
waterTest
normalExposure
aggressiveExposure
marginAllowed

trendScore
breadthScore
leaderScore
followThroughScore
riskScore
confidenceScore

evidenceJson
summary
```

Exposure flags should be resolved to one final recommendation in the report, even if multiple condition flags are true.

## Timeframes

Use multiple timeframes:

- short term: 5 to 20 trading days
- mid term: 20 to 65 trading days
- long term: 100 to 250 trading days
- intraday: current session and 5-minute bars

## Strategy Mapping

Trending markets usually favor:

- breakout
- VCP
- pullback
- holding winners longer
- wider trailing stops

Ranging markets usually favor:

- U&R
- double bottom
- double top
- failed breakout
- support/resistance reversal
- faster profit taking

Quick rotation markets usually favor:

- group setups
- entries close to key levels
- faster exits
- smaller targets
- avoiding late breakouts

Hard penny markets usually favor:

- staying out
- water testing only
- smaller size
- stronger confirmation requirements
- fast exits

Distribution markets usually favor:

- reducing long exposure
- failed breakout shorts
- double tops
- rally failures into moving averages
- leader/index divergence monitoring

Early recovery markets usually favor:

- U&R
- reclaim setups
- 50MA and 200MA reactions
- smaller size until follow-through improves

## Market Fit Question

Every report should answer:

```text
Is this market suitable for our strategy right now?
```

The answer should identify what is working:

- breakouts
- pullbacks
- U&R
- double tops
- failed breakouts
- gap fades
- quick scalps
- nothing, stay defensive
