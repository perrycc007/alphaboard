from __future__ import annotations

import hashlib
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DETECTOR_ROOT = REPO_ROOT / "python setup detector"


SETUP_LOGIC: dict[str, dict[str, object]] = {
    "TREND_LONG_20EMA_PULLBACK": {
        "title": "Trend Long 20EMA Pullback",
        "source_files": [
            "python setup detector/setup_detector/detectors/trend_long_ema20_pullback.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This setup looks for strong uptrends that pushed away from the 20-day EMA and then pulled back in a controlled way. "
            "It only keeps names that are still structurally strong and still acting like leaders instead of breaking trend."
        ),
        "trigger_conditions": [
            "20 EMA must stay above the 50 SMA, and the 50 SMA must not be below the 200 SMA.",
            "Price must have made a meaningful push away from the 20 EMA in the recent window.",
            "The current bar must stay close to the 20 EMA without losing it on the close.",
            "Recent volume should not be expanding aggressively into the pullback.",
            "If swing data is available, there should be a meaningful recent swing high in the prior move.",
        ],
        "common_false_positives": [
            "Weak names drifting sideways near the EMA without a real prior expansion leg.",
            "Pullbacks that are too deep and are already losing the 20 EMA by the close.",
            "Names inside broader base structures where the pullback is not really a trend continuation.",
        ],
    },
    "TREND_LONG_20EMA_LEGACY": {
        "title": "Trend Long 20EMA Legacy",
        "source_files": [
            "python setup detector/setup_detector/detectors/trend_long_ema20_legacy.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This is the looser legacy 20EMA pullback detector. It still wants a bullish trend, but it is more permissive than the strict version and can fire earlier or on softer pullbacks."
        ),
        "trigger_conditions": [
            "Trend order still needs to be bullish enough for a continuation setup.",
            "Price must stay reasonably close to the 20 EMA.",
            "The pullback should still look controlled rather than a full trend failure.",
        ],
        "common_false_positives": [
            "Signals that overlap with base-building instead of true trend continuation.",
            "Setups that are technically near the EMA but lack a powerful prior trend leg.",
            "Names where the looser logic fires repeatedly during chop.",
        ],
    },
    "BASE_FAILURE_SHORT": {
        "title": "Base Failure Short",
        "source_files": [
            "python setup detector/setup_detector/detectors/base_failure_short.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This setup looks for former strength that has already started to fail, then rallies weakly back into moving-average resistance. The idea is to short the weak bounce instead of chasing the first breakdown."
        ),
        "trigger_conditions": [
            "The stock must have already broken meaningfully below the 50 SMA in the recent lookback.",
            "20 EMA must stay below the 50 SMA to confirm a weaker trend structure.",
            "The rally back up should look weak either in price efficiency or in volume behavior.",
            "Price must approach the 50 SMA or 20 EMA from below and still close under that resistance.",
        ],
        "common_false_positives": [
            "Names that are only consolidating and have not truly failed yet.",
            "Sharp squeeze rallies that reclaim moving averages and invalidate the weak-rally idea.",
            "Signals triggered by small MA touches when the broader structure is not bearish enough.",
        ],
    },
    "TREND_SHORT_20EMA_RALLY": {
        "title": "Trend Short 20EMA Rally",
        "source_files": [
            "python setup detector/setup_detector/detectors/trend_short_20ema_rally.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This setup looks for a stock already trending down that rallies back toward the 20 EMA and starts to stall. The intent is to short the weak countertrend bounce, not the initial breakdown."
        ),
        "trigger_conditions": [
            "The broader moving-average structure must still favor a downtrend.",
            "Price should rally back toward the 20 EMA instead of extending far away from it.",
            "The rally should not look powerful enough to suggest a real trend reversal.",
        ],
        "common_false_positives": [
            "Oversold bounces that are actually full reversals.",
            "Temporary EMA touches during noisy sideways action.",
            "Short signals that appear before the downtrend is clearly established.",
        ],
    },
    "BASE_MA_LONG": {
        "title": "Base MA Long",
        "source_files": [
            "python setup detector/setup_detector/detectors/base_ma_long.py",
            "python setup detector/setup_detector/bases.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This setup looks for a stock building a proper base, then finding support around a key moving average inside that base. It is trying to catch a cleaner long entry from support instead of buying a random bounce."
        ),
        "trigger_conditions": [
            "A valid daily base must already be identified.",
            "Price must approach a moving average that matters within that base context.",
            "The touch should happen in a way that still preserves the base instead of breaking it.",
        ],
        "common_false_positives": [
            "Simple mean-reversion bounces that are not happening inside a healthy base.",
            "Deep pullbacks that already damage the base but still touch the moving average.",
            "Signals where the moving-average touch is technically present but structurally low quality.",
        ],
    },
    "BASE_REGION": {
        "title": "Base Region",
        "source_files": [
            "python setup detector/setup_detector/bases.py",
            "python setup detector/setup_detector/detectors/base_region.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This is not a trigger by itself. It marks a daily base region so the reviewer can see where price is consolidating and where later long or short setups are interacting with that structure."
        ),
        "trigger_conditions": [
            "A swing high starts the candidate base.",
            "The base remains valid while retrace, trend support, and breakout invalidation rules are still respected.",
            "Overlapping candidates can merge into a broader region.",
        ],
        "common_false_positives": [
            "Shallow pauses after a run that never truly become a base.",
            "Messy consolidations that are too loose but still pass simple duration checks.",
            "Regions that survive too long after structure is already damaged.",
        ],
    },
    "DOUBLE_TOP": {
        "title": "Double Top",
        "source_files": [
            "python setup detector/setup_detector/detectors/double_top_bottom.py",
            "python setup detector/setup_detector/bases.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This setup looks for price revisiting the top of a base after failing to cleanly break away from it. It tries to warn that resistance is still real and that the second test may become a shortable rejection."
        ),
        "trigger_conditions": [
            "A valid base region must already exist.",
            "Price must approach the base peak closely enough, using an ATR-based band.",
            "There must be enough spacing between repeated alerts.",
            "After a prior alert, price must depart enough from the level before another alert can re-arm.",
        ],
        "common_false_positives": [
            "Repeated small taps near resistance during noise instead of a meaningful retest.",
            "Names that are still tightening constructively and have not actually failed.",
            "Second highs that are too far away in price or too close in time to be meaningful.",
        ],
    },
    "DOUBLE_BOTTOM": {
        "title": "Double Bottom",
        "source_files": [
            "python setup detector/setup_detector/detectors/double_top_bottom.py",
            "python setup detector/setup_detector/bases.py",
            "python setup detector/setup_detector/pipeline.py",
        ],
        "summary_plain": (
            "This setup looks for price revisiting the low of a base and holding it well enough to suggest support is still active. It is the long-side mirror image of the double-top retest logic."
        ),
        "trigger_conditions": [
            "A valid base region must already exist.",
            "Price must approach the base low closely enough, using an ATR-based band.",
            "Repeated alerts need enough spacing and enough departure between tests.",
        ],
        "common_false_positives": [
            "Loose retests that are not really testing the same support level.",
            "Support tests inside broken structures where a bounce is low quality.",
            "Repeated noisy touches that are too small to matter.",
        ],
    },
}


def _resolve_source_files(setup_type: str) -> list[Path]:
    config = SETUP_LOGIC.get(setup_type.upper())
    if not config:
        return []
    return [REPO_ROOT / Path(path) for path in config["source_files"]]


def compute_source_hash(setup_type: str) -> str:
    digest = hashlib.sha1()
    for file_path in _resolve_source_files(setup_type):
        digest.update(str(file_path.relative_to(REPO_ROOT)).encode("utf-8"))
        if file_path.exists():
            digest.update(file_path.read_bytes())
        else:
            digest.update(b"<missing>")
    return digest.hexdigest()


def build_default_snapshot(setup_type: str) -> dict[str, object]:
    normalized = setup_type.upper()
    config = SETUP_LOGIC.get(normalized)
    if not config:
        raise KeyError(f"Unknown setup type: {setup_type}")
    return {
        "setup_type": normalized,
        "title": config["title"],
        "source_files": config["source_files"],
        "source_hash": compute_source_hash(normalized),
        "summary_plain": config["summary_plain"],
        "trigger_conditions": list(config["trigger_conditions"]),
        "common_false_positives": list(config["common_false_positives"]),
        "updated_at": None,
        "origin": "templated",
    }


def build_prompt(
    action: str,
    setup_type: str,
    snapshot: dict[str, object],
    context: dict[str, object] | None = None,
) -> str:
    ctx = context or {}
    normalized = setup_type.upper()
    source_files = snapshot.get("source_files", [])
    summary_plain = snapshot.get("summary_plain", "")
    trigger_conditions = snapshot.get("trigger_conditions", [])
    false_positive_hints = snapshot.get("common_false_positives", [])
    ticker = ctx.get("ticker")
    run_id = ctx.get("run_id")
    chart_id = ctx.get("chart_id")
    notes = ctx.get("notes")
    review_examples = ctx.get("false_positive_examples", [])

    formatted_examples: list[str] = []
    if isinstance(review_examples, list):
        for index, item in enumerate(review_examples, start=1):
            if not isinstance(item, dict):
                continue
            formatted_examples.extend(
                [
                    f"{index}.",
                    *(f"   - ticker: {item.get('ticker')}" for _ in [1] if item.get("ticker")),
                    *(f"   - run id: {item.get('run_id')}" for _ in [1] if item.get("run_id")),
                    *(f"   - chart id: {item.get('chart_id')}" for _ in [1] if item.get("chart_id")),
                    *(f"   - image url: {item.get('asset_url')}" for _ in [1] if item.get("asset_url")),
                    *(f"   - image path: {item.get('chart_path')}" for _ in [1] if item.get("chart_path")),
                    f"   - reviewer comment: {item.get('notes') or '(no comment)'}",
                ]
            )

    prompt = {
        "explain": [
            f"Read the detector logic for {normalized}.",
            "",
            "Source files:",
            *[f"- {item}" for item in source_files],
            "",
            "Please explain the current logic in trader language and layman language.",
            "Cover:",
            "- what market behavior it is trying to capture",
            "- the actual rule checks in plain English",
            "- what usually causes false positives",
            "- which thresholds are the most sensitive",
            "",
            "Do not edit code yet.",
        ],
        "revise": [
            f"Read the detector logic for {normalized}.",
            "",
            "Source files:",
            *[f"- {item}" for item in source_files],
            "",
            f"Current layman summary: {summary_plain}",
            "",
            "Known trigger conditions:",
            *[f"- {item}" for item in trigger_conditions],
            "",
            "Known false positive patterns:",
            *[f"- {item}" for item in false_positive_hints],
            "",
            *(["Current chart context:"] if any([ticker, run_id, chart_id, notes]) else []),
            *(f"- ticker: {ticker}" for _ in [1] if ticker),
            *(f"- run id: {run_id}" for _ in [1] if run_id),
            *(f"- chart id: {chart_id}" for _ in [1] if chart_id),
            *(f"- reviewer notes: {notes}" for _ in [1] if notes),
            "",
            *(["All reviewed false positive examples for this setup:"] + formatted_examples if formatted_examples else []),
            "",
            "Please:",
            "- review the image examples together with the matching reviewer comments",
            "- look for repeated failure patterns across the full set of false positives",
            "- explain why the current logic is likely creating these false positives",
            "- propose the smallest detector change that improves quality",
            "- update the Python detector code",
            "- give me an updated layman summary I can paste back into the review app",
        ],
        "split": [
            f"Read the detector logic for {normalized}.",
            "",
            "Source files:",
            *[f"- {item}" for item in source_files],
            "",
            f"Current layman summary: {summary_plain}",
            "",
            "I suspect this detector is mixing two different setup ideas.",
            "Please:",
            "- explain the current logic first",
            "- identify where it is combining multiple concepts",
            "- split it into two clearly named detector functions if justified",
            "- keep the pipeline output easy to compare",
            "- give me updated layman summaries for both versions",
        ],
        "refresh_summary": [
            f"Read the latest detector code for {normalized}.",
            "",
            "Source files:",
            *[f"- {item}" for item in source_files],
            "",
            "Give me a clean layman explanation for the review UI.",
            "Return exactly this JSON shape:",
            json.dumps(
                {
                    "summary_plain": "One short paragraph.",
                    "trigger_conditions": ["Condition 1", "Condition 2"],
                    "common_false_positives": ["Pattern 1", "Pattern 2"],
                },
                indent=2,
            ),
            "",
            "Use plain English for a trader who does not want to read Python.",
        ],
    }
    lines = prompt.get(action, prompt["explain"])
    return "\n".join(lines).strip()
