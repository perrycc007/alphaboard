# Cursor Guideline For Fine-Tuning Python Detectors

This guide is for the trader who knows the setup logic and wants to use Cursor to tune the detector without needing to be the Python expert.

## 1. Which file to open

Use the notebook that matches the job:

- Daily detector: `notebooks/setup_detectors.ipynb`
- Intraday 620 detector: `notebooks/intraday_setup_620.ipynb`
- Parameter presets: `notebooks/rule_configs/v1.json`

Use `setup_detectors.ipynb` for:

- swing highs / swing lows
- significant swings
- daily bases
- double top / double bottom
- EMA20 / SMA50 pullback logic
- batch review exports

Use `intraday_setup_620.ipynb` for:

- intraday setup rectangle / base detection
- 6/20 cross logic
- setup alert and entry timing
- live intraday monitoring

## 2. How to run the detector in Cursor

### Daily notebook

Open `notebooks/setup_detectors.ipynb`.

Run the notebook from top to bottom the first time.

Important cells:

- Cell 3: fetch daily data
- Cell 23 to 25: tuning + final runner
- Cell 31: diagnostic for base + double top / double bottom

Main values to edit first:

```python
TICKER = "PLTR"
PERIOD = "2y"
INTERVAL = "1d"
```

### Intraday notebook

Open `notebooks/intraday_setup_620.ipynb`.

Run from top to bottom the first time.

Important cells:

- Cell 2: config
- Cell 3: load intraday data
- Cell 4: core detector logic
- Cell 9: live monitor

Main values to edit first:

```python
TICKER = "SATS"
INTERVAL = "5m"
USE_SPECIFIC_DAY = True
SPECIFIC_DAY = "2026-02-18"
```

## 3. How to change the ticker

### Daily

In `setup_detectors.ipynb` change:

```python
TICKER = "PLTR"
```

Then re-run:

1. the fetch cell
2. the indicator / function cells if needed
3. the final runner or diagnostic cell

### Intraday

In `intraday_setup_620.ipynb` change:

```python
TICKER = "SATS"
SPECIFIC_DAY = "2026-02-18"
INTERVAL = "5m"
```

Then re-run:

1. the config cell
2. the load-data cell
3. the detection cell
4. the chart / summary cell

### Rule of thumb

- If you only changed ticker, date, period, or interval: re-run the config/data cells and the output cells.
- If you changed a function: re-run that function cell and every result/chart cell after it.
- If things look wrong after a code edit: restart the notebook kernel and run top to bottom again.

## 4. How to ask Cursor for the current logic

Always ask Cursor to explain before asking it to change code.

Good prompts:

- `Read notebooks/setup_detectors.ipynb and explain the current logic for detect_significant_swings in plain English. Focus on what qualifies a high, what qualifies a low, and which parameters control sensitivity. Do not change code yet.`
- `Read notebooks/setup_detectors.ipynb and explain how detect_daily_base_candidates currently defines a base, its invalidation rules, and where false positives can happen. Do not edit anything yet.`
- `Read notebooks/intraday_setup_620.ipynb and explain the current setup rules inside detect_intraday_setups_with_620_entry. Summarize the setup condition, the no-cross condition, compression checks, and the 620 entry trigger.`
- `List the detector functions in notebooks/setup_detectors.ipynb and group them into swing detection, base detection, trend-following entries, and reversal logic.`

What you want Cursor to give back:

- the function name
- the exact purpose of the function
- the rules in trader language
- the parameters that matter most
- likely false positives and false negatives

## 5. Best workflow for improving logic

Use this sequence every time:

1. Run the notebook on one ticker where the detector is wrong.
2. Point Cursor to the exact function that produced the wrong result.
3. Describe the chart behavior in trader language.
4. Ask Cursor to translate that trader rule into code logic.
5. Ask Cursor to apply the change in the notebook.
6. Re-run the same ticker and compare before vs after.
7. Test on 3 to 5 more tickers before keeping the change.

Use real examples:

- one clean positive example
- one obvious false positive
- one borderline case

## 6. Prompt template for "improve this logic"

Use this when the current detector is close, but not good enough:

```text
Read notebooks/setup_detectors.ipynb.

Focus on function: detect_daily_base_candidates.

Current problem:
- it is marking bases too early
- it should only count as a base after the stock stops making meaningful highs
- a shallow pause after a strong move should not automatically become a base

Please do this:
- explain the current logic first
- propose the smallest code change that matches the new rule
- apply the code change in the notebook
- keep the old function name unless a split is cleaner
- add brief comments only where the logic is not obvious
```

## 7. Prompt template for "apply my new trader logic"

Use this when your partner already knows the exact rule:

```text
Read notebooks/intraday_setup_620.ipynb.

I want to change detect_intraday_setups_with_620_entry.

New trader logic:
- after a push to a high or low, price can build a setup
- during the setup there should be no 6/20 cross
- the range should stay tight
- if the move before the setup was too weak, ignore it
- if the setup drifts too far from the peak, ignore it
- keep the first valid 620 cross as the entry trigger

Please:
- restate this as precise code rules before editing
- identify which current checks already cover this
- add only the missing logic
- update the notebook code directly
```

## 8. When you want to add logic

Use this when the existing rule is fine, but incomplete.

Examples:

- add a volume contraction check
- add a minimum separation between two peaks
- add a market-stage filter
- add a "meaningful departure" requirement before calling it a swing

Good prompt:

```text
Read notebooks/setup_detectors.ipynb.

I want to extend detect_double_top_bottom_alert_entry with one extra filter:
- only allow a double top if the second high approaches the first high within X ATR
- reject it if there was no clean downside departure after the first high

Please:
- show me where this logic belongs
- add it without breaking the current alert/entry flow
- keep the code readable for future tuning
```

## 9. When you want to split one logic into two

This is one of your main workflows, so make it explicit with Cursor.

Use a split when:

- one function is doing two different setup types
- you want strict and loose versions
- you want trend logic separate from reversal logic
- you want detection separate from alert/entry logic

Good split patterns:

- `detect_ema20_pullback` into `detect_trend_long_ema20_pullback_strict` and `detect_ema20_pullback`
- one double-top detector into `detect_double_top_strict` and `detect_double_top_loose`
- one base function into `detect_daily_base_candidates` and `merge_overlapping_bases`
- one function for raw detection and one function for alert/entry conversion

Prompt template:

```text
Read notebooks/setup_detectors.ipynb.

I want to split the current logic in detect_ema20_pullback into two separate detectors:

1. strict trend continuation
2. looser legacy pullback

Please:
- keep the current behavior available
- create two clearly named functions
- move shared code into a helper only if it makes the notebook easier to tune
- update the runner so both results still appear separately
- explain which parameters belong to each version
```

## 10. When you only want threshold tuning, not logic changes

Do not ask Cursor to rewrite the function if the issue is only sensitivity.

Daily tuning values already exposed in `setup_detectors.ipynb` and `notebooks/rule_configs/v1.json` include:

- `FRACTAL_LOOKAHEAD`
- `SIG_LEFT`
- `SIG_RIGHT`
- `SIG_PROM_ATR`
- `SIG_DEPART_ATR`
- `SIG_DEPART_LOOK`
- `SIG_MIN_SEP`
- `MERGE_PCT`
- `MIN_TOUCHES`
- `EMA20_DIST_ATR`
- `EMA20_DEPART_WIN`
- `BASE_MIN_DURATION`
- `BASE_MAX_RETRACE`

Intraday tuning values in `intraday_setup_620.ipynb` include:

- `MIN_BASE_BARS`
- `MAX_BASE_BARS`
- `MAX_RANGE_PCT`
- `MAX_WAIT_FOR_CROSS`
- `EFFICIENCY_MAX`
- `EMA_GAP_CAP_PCT`
- `EMA_GAP_NEG_FRAC_MIN`
- `DRIFT_CAP_PCT`
- `MIN_COMPRESSION_RULES`

Good prompt:

```text
Do not change the detector structure.

Read notebooks/setup_detectors.ipynb and tell me which 3 parameters are most likely causing too many swing highs on this ticker.

Explain:
- which parameter makes the detector stricter
- which parameter makes it looser
- what small test changes you recommend first
```

## 11. How to validate changes properly

Do not trust one chart.

After any change:

1. re-run the same ticker that exposed the issue
2. test at least one ticker where the old logic worked
3. test a few unrelated names
4. compare detector counts before and after
5. check whether the chart still matches trader intuition

Helpful places in the daily notebook:

- final runner cells
- signal tables
- forward return output
- cell 31 diagnostic for base + DT/DB
- batch review/export cells for many tickers

## 12. What to tell Cursor so it does not over-edit

Good guardrails:

- `Explain first, edit second.`
- `Make the smallest possible code change.`
- `Do not rewrite unrelated detectors.`
- `Preserve existing parameter names unless a rename is necessary.`
- `Keep output shape unchanged if possible.`
- `If you split logic, update the runner and chart labels too.`
- `Do not remove the legacy logic until I compare both versions.`

## 13. Recommended teaching script for your partner

You can teach him this exact routine:

1. Open the right notebook.
2. Change ticker/date first.
3. Run the notebook and look at the chart, not just the table.
4. Find the wrong signal.
5. Ask Cursor to explain the current logic for that signal.
6. Describe the trader rule in plain language.
7. Ask Cursor to convert that trader rule into code.
8. Re-run and compare before vs after.
9. If the new rule is truly a different setup, split it into a second detector instead of forcing one detector to do everything.

## 14. Simple prompts your partner can copy every day

### Explain current logic

```text
Read this notebook and explain the current logic for this detector in trader language first. Do not edit code yet.
```

### Find where to edit

```text
Show me which function controls this setup and which parameters I should tune first before changing code.
```

### Apply new logic

```text
I want to keep the current detector, but add this new rule: [describe trader rule].
Please restate it as code logic, then apply the smallest possible change.
```

### Split logic into two detectors

```text
This is now two different setups, not one. Split the current logic into two functions, keep both outputs visible, and label them clearly in the runner.
```

### Compare old vs new

```text
Keep the legacy version and add a strict version beside it so I can compare both on the same ticker.
```

## 15. Repo-specific notes

- Daily detector notebook starts with a simple yfinance fetch in cell 3.
- Intraday detector config is in cell 2 and data load is in cell 3.
- Daily batch review logic uses `REVIEW_TICKERS` and `RULE_VERSION`.
- The notebook already has both strict and legacy style logic in places, so splitting logic is a good fit for this codebase.
- `notebooks/rule_configs/v1.json` is the clean place for parameter-only tuning once the notebook defaults are stable.

## 16. One-line mindset

Use Cursor as a translator:

- trader idea -> precise rule
- precise rule -> smallest code change
- code change -> rerun on charts

If the result is still unclear, ask Cursor to explain the code again in trader language before making the next change.
