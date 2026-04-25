from __future__ import annotations

import numpy as np
import pandas as pd

from .bases import detect_daily_base_candidates, ensure_base_lows_are_significant_swings, merge_overlapping_bases
from .config import ReviewConfig
from .detectors import (
    build_base_region_signals,
    detect_base_failure_rally_short,
    detect_base_ma_long,
    detect_double_top_bottom_alert_entry,
    detect_ema20_pullback,
    detect_trend_long_ema20_pullback_strict,
    detect_trend_short_ema20_rally,
)
from .indicators import add_indicators
from .models import EntrySignal
from .swings import detect_significant_swings


def _infer_direction(signal: EntrySignal) -> str:
    metadata = signal.metadata if isinstance(signal.metadata, dict) else {}
    direction = str(metadata.get("direction", "")).upper()
    if direction in {"LONG", "SHORT"}:
        return direction
    signal_type = signal.type.upper()
    if "SHORT" in signal_type or "FAILURE" in signal_type:
        return "SHORT"
    return "LONG"


def _key_level(signal: EntrySignal) -> float:
    metadata = signal.metadata if isinstance(signal.metadata, dict) else {}
    for key in ["key_level", "pivot_level", "support_level", "resistance_level", "trigger_level", "entry_level"]:
        value = metadata.get(key)
        if value is not None and np.isfinite(float(value)):
            return float(value)
    return float(signal.price)


def _wick_intercepts(df_ctx: pd.DataFrame, t: int, level: float) -> bool:
    return float(df_ctx["low"].iloc[t]) <= level <= float(df_ctx["high"].iloc[t])


def split_alert_and_entry_signals(
    df_ctx: pd.DataFrame,
    setup_name: str,
    source_signals: list[EntrySignal],
) -> tuple[list[EntrySignal], list[EntrySignal]]:
    alerts: list[EntrySignal] = []
    entries: list[EntrySignal] = []

    for signal in source_signals:
        t = int(signal.index)
        if t < 0 or t >= len(df_ctx):
            continue

        direction = _infer_direction(signal)
        key_level = _key_level(signal)
        metadata = dict(signal.metadata) if isinstance(signal.metadata, dict) else {}
        metadata.update({"setup_class": setup_name, "signal_origin": signal.type, "direction": direction, "key_level": key_level})

        alerts.append(
            EntrySignal(
                index=t,
                date=signal.date,
                price=float(key_level),
                type=f"{setup_name}_ALERT",
                stop=signal.stop,
                target=signal.target,
                rr=signal.rr,
                metadata={**metadata, "signal_kind": "ALERT"},
            )
        )

        if _wick_intercepts(df_ctx, t, key_level):
            entries.append(
                EntrySignal(
                    index=t,
                    date=signal.date,
                    price=float(key_level),
                    type=f"{setup_name}_ENTRY",
                    stop=signal.stop,
                    target=signal.target,
                    rr=signal.rr,
                    metadata={**metadata, "signal_kind": "ENTRY"},
                )
            )

    return alerts, entries


def run_detection_pipeline(df_window: pd.DataFrame, config: ReviewConfig) -> tuple[list[tuple[str, EntrySignal]], pd.DataFrame, list[dict]]:
    dfw = add_indicators(df_window)
    if len(dfw) < config.min_window_bars:
        return [], dfw, []

    sig_swings = detect_significant_swings(
        dfw,
        left=config.sig_left,
        right=config.sig_right,
        prom_atr=config.sig_prom_atr,
        depart_atr=config.sig_depart_atr,
        depart_lookahead=config.sig_depart_look,
        min_swing_sep=config.sig_min_sep,
    )

    base_raw = detect_daily_base_candidates(dfw, sig_swings, min_base_duration=20, max_retrace=0.50, contraction_tail=5)
    base_merged = merge_overlapping_bases(base_raw, dfw, contraction_tail=5)
    sig_swings = ensure_base_lows_are_significant_swings(dfw, sig_swings, base_merged)

    strict_long = detect_trend_long_ema20_pullback_strict(
        dfw,
        sig_swings,
        dist_atr_max=config.ema20_dist_atr,
        departure_atr=1.3,
        departure_window=config.ema20_depart_win,
        target_rr=config.ema20_target_rr,
    )
    legacy_long = detect_ema20_pullback(
        dfw,
        dist_atr_max=config.ema20_dist_atr,
        departure_atr=1.3,
        departure_window=config.ema20_depart_win,
        target_rr=config.ema20_target_rr,
    )
    for signal in legacy_long:
        signal.type = "TREND_LONG_20EMA_LEGACY"
        signal.metadata["setup_label"] = "Trend Long (20EMA Legacy)"
        signal.metadata["direction"] = "LONG"

    base_failure = detect_base_failure_rally_short(dfw)
    trend_short = detect_trend_short_ema20_rally(
        dfw,
        sig_swings,
        dist_atr_max=config.ema20_dist_atr,
        departure_atr=2.0,
        departure_window=config.ema20_depart_win,
    )

    in_base = np.zeros(len(dfw), dtype=bool)
    for base in base_merged:
        start_idx, end_idx = int(base["start_idx"]), int(base["end_idx"])
        in_base[start_idx : end_idx + 1] = True
    strict_long = [signal for signal in strict_long if not in_base[signal.index]]
    legacy_long = [signal for signal in legacy_long if not in_base[signal.index]]

    base_ma_long = detect_base_ma_long(dfw, base_merged, dist_atr_max=config.ema20_dist_atr, target_rr=config.ema20_target_rr)
    base_regions = build_base_region_signals(dfw, base_merged)

    strict_long_alerts, _ = split_alert_and_entry_signals(dfw, "TREND_LONG_20EMA_PULLBACK", strict_long)
    legacy_long_alerts, _ = split_alert_and_entry_signals(dfw, "TREND_LONG_20EMA_LEGACY", legacy_long)
    base_failure_alerts, _ = split_alert_and_entry_signals(dfw, "BASE_FAILURE_SHORT", base_failure)
    trend_short_alerts, _ = split_alert_and_entry_signals(dfw, "TREND_SHORT_20EMA_RALLY", trend_short)
    base_ma_alerts, _ = split_alert_and_entry_signals(dfw, "BASE_MA_LONG", base_ma_long)

    double_top_alerts, _, double_bottom_alerts, _, _ = detect_double_top_bottom_alert_entry(
        dfw,
        base_merged,
        approach_atr_mult=0.50,
        min_bar_spacing=7,
        departure_atr_mult=1.0,
    )

    results: list[tuple[str, EntrySignal]] = []
    grouped = [
        ("TREND_LONG_20EMA_PULLBACK", strict_long_alerts),
        ("TREND_LONG_20EMA_LEGACY", legacy_long_alerts),
        ("BASE_FAILURE_SHORT", base_failure_alerts),
        ("TREND_SHORT_20EMA_RALLY", trend_short_alerts),
        ("BASE_MA_LONG", base_ma_alerts),
        ("BASE_REGION", base_regions),
        ("DOUBLE_TOP", double_top_alerts),
        ("DOUBLE_BOTTOM", double_bottom_alerts),
    ]
    for setup_type, alerts in grouped:
        for signal in alerts:
            results.append((setup_type, signal))

    return results, dfw, base_merged
