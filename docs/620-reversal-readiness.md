# 620 Reversal Readiness

## Principle

620 is for reversal timing only. It should not be treated as an immediate entry command.

620 is lower priority than daily setup quality and intraday setup structure.

The goal is:

```text
alert when a reversal candidate is almost ready
not force an immediate trade
```

The user still decides whether to enter, wait, or skip.

## Role In The Workflow

```text
Daily/group setup finds what to watch.
Intraday setup structure shows whether a real reversal is forming.
Key level defines where reversal matters.
Program detects early 620 readiness.
LLM or visual model checks whether the reversal structure is worth attention.
User makes the trade decision.
```

Priority:

```text
daily setup > group/market context > intraday setup > 620 readiness
```

If the daily setup is weak, do not care about 620. If the intraday structure is not forming, treat 620 readiness as low value.

## What Program Should Do

The program should monitor only focus-list stocks that already have reversal context.

Valid reversal contexts include:

- U&R
- double bottom
- double top
- failed breakout
- gap up fade
- gap down reversal
- rally into moving-average resistance
- pullback into support reversal
- head and shoulders
- neckline reclaim or rejection

Intraday setup structure should be checked before upgrading a 620 alert. Important intraday structures include:

- intraday double top
- intraday double bottom
- intraday base
- intraday failed breakout
- intraday U&R
- VWAP rejection
- VWAP reclaim
- gap fade
- gap reversal

The program calculates:

- 5-minute bars
- EMA6
- EMA20
- EMA6 minus EMA20 gap
- MACD 6/20/9
- MACD histogram
- VWAP
- distance to planned key level
- price reclaim or rejection behavior

## Readiness States

Use a state machine.

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

State meaning:

- `WATCHING`: focus-list stock with reversal setup context.
- `TESTING_LEVEL`: price is at the planned support, resistance, VWAP, gap level, swing level, or moving average.
- `COMPRESSING`: EMA6/EMA20 gap and MACD histogram are contracting toward a possible cross.
- `ALMOST_READY`: price is holding/rejecting the level and 620 is close to crossing.
- `READY_TO_CONFIRM`: one more strong 5-minute bar could trigger the cross.
- `CROSSED`: cross happened near the planned key level.
- `FAILED`: setup violated before useful confirmation.
- `STALE`: price moved away or too much time passed.

## Early Warning Logic

The most important alerts are before the actual cross:

```text
TESTING_LEVEL
COMPRESSING
ALMOST_READY
READY_TO_CONFIRM
```

Do not wait until `CROSSED` to notify the user. The value of 620 is reducing monitoring workload.

## Program Readiness Conditions

Long reversal readiness:

```text
stock is focusToday
direction is LONG
price is near support or reclaim level
price has not violated the setup
EMA6 is below or near EMA20
EMA6/EMA20 gap is contracting
MACD histogram is improving
latest bars show reclaim, absorption, or selling pressure fading
```

Short reversal readiness:

```text
stock is focusToday
direction is SHORT
price is near resistance or rejection level
price has not invalidated the short thesis
EMA6 is above or near EMA20
EMA6/EMA20 gap is contracting
MACD histogram is weakening
latest bars show rejection, failed breakout, or buying pressure fading
```

## Model Responsibilities

Use the program for fast early detection. Use models for judgment.

LLM or visual model should answer:

- does this chart actually look like a reversal setup?
- is there a real intraday setup forming, or only a near-cross?
- is the level meaningful?
- is the candidate almost ready or still too early?
- is the pattern clean enough to watch closely?
- is there group or market support?
- should this alert be upgraded, ignored, or kept on watch?

Visual model is especially useful for:

- double top
- double bottom
- head and shoulders
- wedge or trendline break
- failed breakout shape
- group gallery reversal context

LLM with dataframe is useful for:

- exact distance to key level
- EMA/MACD compression
- volume behavior
- setup state
- recent recommendation outcome
- market condition fit

## Alert Types

Use layered alerts:

```text
620 Watch: price approaching reversal level.
620 Compressing: EMA/MACD close to reversal cross.
620 Almost Ready: structure and 620 both near confirmation.
620 Crossed: cross occurred near planned level.
620 Failed: setup violated or moved away.
```

Example alert:

```text
620 Almost Ready: NVDA testing 20EMA support.
Setup: long reversal / pullback reclaim.
Evidence: EMA6/20 gap contracting, MACD histogram improving, price holding above support.
Action: watch next 5-minute bars; no automatic entry.
```

## Daily Update Integration

Daily focus-list updates should decide which tickers deserve intraday 620 monitoring.

Only monitor 620 when:

- `focusToday = true`
- setup is reversal-oriented
- daily setup quality is good enough
- intraday setup structure is forming or already formed
- planned key level is close enough
- market condition supports reversal setup
- group context is acceptable

## Non-Goals

620 should not:

- scan the entire market
- generate random cross alerts away from key levels
- replace daily setup analysis
- replace intraday setup analysis
- replace group context
- force immediate entry
