from __future__ import annotations

import numpy as np
import pandas as pd

from ..models import EntrySignal


def _wick_intercepts(df_ctx: pd.DataFrame, t: int, level: float) -> bool:
    return float(df_ctx["low"].iloc[t]) <= level <= float(df_ctx["high"].iloc[t])


def detect_double_top_bottom_alert_entry(
    df_ctx: pd.DataFrame,
    base_regions: list[dict],
    approach_atr_mult: float = 0.50,
    min_bar_spacing: int = 7,
    departure_atr_mult: float = 1.5,
) -> tuple[list[EntrySignal], list[EntrySignal], list[EntrySignal], list[EntrySignal], dict]:
    atr = df_ctx["atr14"].values
    closes = df_ctx["close"].values

    dt_alerts: list[EntrySignal] = []
    dt_entries: list[EntrySignal] = []
    db_alerts: list[EntrySignal] = []
    db_entries: list[EntrySignal] = []

    stats = {
        "dt_approached": 0,
        "dt_blocked_spacing": 0,
        "dt_blocked_departure": 0,
        "dt_emitted": 0,
        "db_approached": 0,
        "db_blocked_spacing": 0,
        "db_blocked_departure": 0,
        "db_emitted": 0,
    }

    def check_departure_dt(level: float, from_idx: int, to_idx: int) -> tuple[float, float]:
        if to_idx - from_idx <= 1:
            return 0.0, 0.0
        segment = closes[from_idx + 1 : to_idx]
        if len(segment) == 0:
            return 0.0, 0.0
        k = from_idx + 1 + int(np.argmin(segment))
        departure = level - float(closes[k])
        atr_ref = float(atr[k]) if np.isfinite(atr[k]) and atr[k] > 0 else 1e-9
        return departure, departure / atr_ref

    def check_departure_db(level: float, from_idx: int, to_idx: int) -> tuple[float, float]:
        if to_idx - from_idx <= 1:
            return 0.0, 0.0
        segment = closes[from_idx + 1 : to_idx]
        if len(segment) == 0:
            return 0.0, 0.0
        k = from_idx + 1 + int(np.argmax(segment))
        departure = float(closes[k]) - level
        atr_ref = float(atr[k]) if np.isfinite(atr[k]) and atr[k] > 0 else 1e-9
        return departure, departure / atr_ref

    for base in base_regions:
        start_idx = int(base["start_idx"])
        end_idx = int(base["end_idx"])
        if end_idx <= start_idx:
            continue

        peak_level = float(base.get("peak_price", base.get("base_high")))
        low_level = float(base.get("base_low"))
        peak_idx = int(base.get("peak_idx", start_idx))
        low_anchor_idx = start_idx + int(np.argmin(closes[start_idx : end_idx + 1]))

        dt_last_alert_idx: int | None = None
        db_last_alert_idx: int | None = None

        for t in range(start_idx, end_idx + 1):
            atr_ref = atr[t] if np.isfinite(atr[t]) and atr[t] > 0 else 0.0
            band = approach_atr_mult * atr_ref
            close = float(closes[t])

            is_dt_approach = (abs(close - peak_level) <= band) if band > 0 else (close == peak_level)
            if is_dt_approach:
                stats["dt_approached"] += 1
                anchor = peak_idx if dt_last_alert_idx is None else dt_last_alert_idx
                bars_since = t - anchor
                if bars_since < min_bar_spacing:
                    stats["dt_blocked_spacing"] += 1
                else:
                    dep_abs, dep_mult = (0.0, 0.0)
                    rearm_passed = True
                    if dt_last_alert_idx is not None:
                        dep_abs, dep_mult = check_departure_dt(peak_level, dt_last_alert_idx, t)
                        rearm_passed = dep_mult >= departure_atr_mult
                    if not rearm_passed:
                        stats["dt_blocked_departure"] += 1
                    else:
                        stats["dt_emitted"] += 1
                        metadata = {
                            "setup_class": "DOUBLE_TOP",
                            "signal_kind": "ALERT",
                            "key_level": peak_level,
                            "direction": "SHORT",
                            "parent_base_peak_idx": peak_idx,
                            "bars_since_last_alert": bars_since,
                            "max_departure_abs": round(dep_abs, 3),
                            "departure_atr_mult": round(dep_mult, 3),
                            "rearm_passed": rearm_passed,
                        }
                        dt_alerts.append(
                            EntrySignal(
                                index=t,
                                date=df_ctx["date"].iloc[t],
                                price=peak_level,
                                type="DOUBLE_TOP_ALERT",
                                stop=peak_level,
                                target=peak_level,
                                rr=0.0,
                                metadata=metadata,
                            )
                        )
                        if _wick_intercepts(df_ctx, t, peak_level):
                            dt_entries.append(
                                EntrySignal(
                                    index=t,
                                    date=df_ctx["date"].iloc[t],
                                    price=peak_level,
                                    type="DOUBLE_TOP_ENTRY",
                                    stop=peak_level,
                                    target=peak_level,
                                    rr=0.0,
                                    metadata={**metadata, "signal_kind": "ENTRY"},
                                )
                            )
                        dt_last_alert_idx = t

            is_db_approach = (abs(close - low_level) <= band) if band > 0 else (close == low_level)
            if is_db_approach:
                stats["db_approached"] += 1
                anchor = low_anchor_idx if db_last_alert_idx is None else db_last_alert_idx
                bars_since = t - anchor
                if bars_since < min_bar_spacing:
                    stats["db_blocked_spacing"] += 1
                else:
                    dep_abs, dep_mult = (0.0, 0.0)
                    rearm_passed = True
                    if db_last_alert_idx is not None:
                        dep_abs, dep_mult = check_departure_db(low_level, db_last_alert_idx, t)
                        rearm_passed = dep_mult >= departure_atr_mult
                    if not rearm_passed:
                        stats["db_blocked_departure"] += 1
                    else:
                        stats["db_emitted"] += 1
                        metadata = {
                            "setup_class": "DOUBLE_BOTTOM",
                            "signal_kind": "ALERT",
                            "key_level": low_level,
                            "direction": "LONG",
                            "parent_base_peak_idx": peak_idx,
                            "bars_since_last_alert": bars_since,
                            "max_departure_abs": round(dep_abs, 3),
                            "departure_atr_mult": round(dep_mult, 3),
                            "rearm_passed": rearm_passed,
                        }
                        db_alerts.append(
                            EntrySignal(
                                index=t,
                                date=df_ctx["date"].iloc[t],
                                price=low_level,
                                type="DOUBLE_BOTTOM_ALERT",
                                stop=low_level,
                                target=low_level,
                                rr=0.0,
                                metadata=metadata,
                            )
                        )
                        if _wick_intercepts(df_ctx, t, low_level):
                            db_entries.append(
                                EntrySignal(
                                    index=t,
                                    date=df_ctx["date"].iloc[t],
                                    price=low_level,
                                    type="DOUBLE_BOTTOM_ENTRY",
                                    stop=low_level,
                                    target=low_level,
                                    rr=0.0,
                                    metadata={**metadata, "signal_kind": "ENTRY"},
                                )
                            )
                        db_last_alert_idx = t

    return dt_alerts, dt_entries, db_alerts, db_entries, stats
