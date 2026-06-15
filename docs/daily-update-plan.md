# Daily Update Plan

## Principle

After a full scan has made the main decisions, normal trading days should not re-run the whole market or deep visual review. They should monitor the focus list and decide whether each item should be a focus that trading day.

## Inputs

Normal-day updates use:

- focus-list stocks
- major indexes and ETFs
- current market condition snapshot
- updated OHLCV and indicators
- key levels and setup states
- group/theme dataframe metrics
- active catalyst hypotheses
- prior recommendations and outcomes

## Daily Update Steps

```text
1. Fetch focus-list stocks only.
2. Update OHLCV, moving averages, ATR, volume ratio, and key-level distance.
3. Update setup state.
4. Reconfirm daily setup quality and location.
5. Check violation, trigger, extension, and expiry.
6. Check group synchronization by dataframe metrics.
7. Check market condition support.
8. Check whether a real intraday setup is forming.
9. Decide focusToday true or false for each item.
10. Decide which focusToday reversal candidates deserve intraday 620 readiness monitoring.
11. Produce a short daily report.
```

## Focus Today Decision

Every focus-list item should receive:

```text
focusToday: true or false
focusTodayReason
dailyAction
```

Daily action options:

- focus for trade today
- monitor only
- wait for key level
- wait for group confirmation
- reduce priority
- remove from focus list
- violated
- triggered
- too extended
- stale
- monitor 620 readiness

## Focus Today Criteria

Set `focusToday = true` when several of these are true:

- daily setup remains strong enough
- price is near the planned key level
- setup is ready or close to ready
- group is synchronized
- market condition supports the setup type
- catalyst hypothesis is technically confirming
- risk/reward is still acceptable
- volume behavior supports the thesis
- prior similar setups are working in the current market
- intraday setup is forming or likely to form
- reversal candidate is close enough for 620 readiness monitoring, if relevant

Set `focusToday = false` when:

- price moved too far from entry
- setup violated
- group fell out of sync
- market condition no longer supports it
- breadth divergence increased materially
- expected move already happened
- better candidates exist in the same group

## Daily Report

The daily update should answer:

- what should be the focus today?
- which stocks are actionable today?
- which stocks are monitor only?
- is the daily setup still good enough?
- is there an intraday setup forming?
- which setups triggered?
- which setups violated?
- which groups remain synchronized?
- what changed in market condition?
- should exposure stay the same, reduce, or increase?
- what exit updates are needed?
- which reversal candidates should be watched for 620 readiness today?

## Exit Strategy Updates

Daily update should refresh exit logic:

- scalp exit for quick rotation or hard penny markets
- partial profit at 1R to 3R when follow-through is weak
- swing exit when pullbacks and breakouts are following through
- trend hold only when easy-money conditions and leader confirmation are present
- reduce or exit when violation appears
- trail under higher low, setup low, 10MA, 20EMA, or relevant key level depending on regime

## No Daily Deep Vision By Default

Daily visual model review should only happen when:

- a stock becomes newly actionable
- a major trigger or violation occurs
- group structure changes sharply
- the user requests visual confirmation
- the dataframe result is ambiguous
