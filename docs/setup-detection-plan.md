# Setup Detection Plan

## Principle

First-pass setup detection should be loose.

The scanner should prefer:

```text
more false positives
fewer false negatives
```

Later dataframe review, visual review, and user review will remove weak candidates.

## Setup Priority

Prioritize setup evidence in this order:

```text
1. Daily setup
2. Group/theme setup
3. Intraday setup
4. 620 reversal readiness
```

Daily setup quality and location matter most. Intraday setup should refine timing and context, not rescue a weak daily chart. 620 should sit below intraday setup and only act as a readiness alert for reversal candidates.

## Objective Calculations

Code should calculate:

- SMA20, SMA50, SMA150, SMA200
- EMA6, EMA20
- ATR14
- average bar size
- average volume
- relative volume
- 52-week high and low
- RS rank or relative strength
- distance to moving averages
- distance to swing highs and lows
- stage classification
- leader status
- group/theme breadth

## Key Levels

The first scanner is mainly a key-level detector.

Track:

- swing high
- swing low
- base high
- base low
- VCP pivot
- prior breakout pivot
- 20MA, 50MA, 150MA, 200MA
- VWAP for intraday
- psychological levels when useful

## Candidate Conditions

Pass a stock to the next step if it is tradable and near an important level.

Examples:

- price near swing high
- price near swing low
- price near 20EMA or 50MA
- price near 200MA
- price near prior pivot
- price near base high or base low
- price reclaiming or losing a key level
- volume expanding or contracting near a key level

## Loose Setup Labels

The program may attach one or more loose labels:

- possible pullback
- possible U&R
- possible double top
- possible double bottom
- possible VCP
- possible failed breakout
- possible base
- possible rally failure
- possible gap reaction
- possible 620 timing setup

Intraday labels should include:

- possible intraday double top
- possible intraday double bottom
- possible intraday base
- possible intraday failed breakout
- possible intraday U&R
- possible VWAP rejection
- possible VWAP reclaim
- possible gap fade
- possible gap reversal

These labels are not final decisions. They are routing hints for review.

## Dataframe Review Packet

Do not send the entire raw dataframe unless required. Send a compact packet:

```text
ticker
theme and group
stage and leader status
candidate setup labels
latest price
moving averages
ATR
volume ratio
nearby key levels
last 80 to 120 bars compressed
program evidence
possible violations
group breadth stats
recent recommendation outcome if any
```

The dataframe packet is the source of truth for exact values.

## Model Responsibility

Cheap structured models should classify:

- valid candidate
- weak candidate
- reject
- needs visual review

They should score:

- setup clarity
- risk/reward quality
- key-level quality
- group confirmation
- violation risk
- whether it should be focus today

## Output

Each candidate should produce:

- setup type
- direction
- key level
- entry area
- invalidation level
- target or expected move
- reason
- violation warning
- review status
- confidence score
