from __future__ import annotations

import numpy as np
import pandas as pd

from .models import SwingPoint


def detect_daily_base_candidates(
    df: pd.DataFrame,
    swings: list[SwingPoint],
    min_base_duration: int = 20,
    max_retrace: float = 0.50,
    contraction_tail: int = 5,
) -> list[dict]:
    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    sma200 = df["sma200"].values
    atr = df["atr14"].values
    n = len(df)
    peak_swings = sorted([swing for swing in swings if swing.type == "HIGH"], key=lambda swing: swing.index)
    out: list[dict] = []

    for peak in peak_swings:
        peak_idx = peak.index
        peak_price = float(peak.price)
        if peak_idx >= n - min_base_duration:
            continue

        atr_ref = atr[peak_idx] if np.isfinite(atr[peak_idx]) and atr[peak_idx] > 0 else np.nan
        if not np.isfinite(atr_ref) or atr_ref <= 0:
            continue

        breakout_level = peak_price + atr_ref
        span_low = peak_price
        last_valid_idx = None
        invalid_reason = None

        for t in range(peak_idx, n):
            span_low = min(span_low, float(lows[t]))
            retrace = (peak_price - span_low) / peak_price if peak_price > 0 else 1.0
            broke_retrace = retrace > max_retrace
            below_200 = (not np.isfinite(sma200[t])) or (closes[t] < sma200[t])
            broke_out = highs[t] > breakout_level

            if broke_retrace:
                invalid_reason = "retrace_gt_50pct"
                break
            if below_200:
                invalid_reason = "close_below_sma200"
                break
            if broke_out:
                invalid_reason = "breakout_above_peak_plus_1atr"
                break

            last_valid_idx = t

        if last_valid_idx is None:
            continue

        duration = last_valid_idx - peak_idx + 1
        if duration < min_base_duration:
            continue

        base_high = float(np.max(highs[peak_idx : last_valid_idx + 1]))
        base_low = float(np.min(lows[peak_idx : last_valid_idx + 1]))
        retrace = (peak_price - base_low) / peak_price if peak_price > 0 else 1.0
        mid_idx = max(peak_idx + 1, last_valid_idx - contraction_tail + 1)
        contraction_high = float(np.max(highs[mid_idx : last_valid_idx + 1]))
        contraction_low = float(np.min(lows[mid_idx : last_valid_idx + 1]))
        base_height = max(base_high - base_low, 1e-9)
        contraction_ratio = (contraction_high - contraction_low) / base_height

        out.append(
            {
                "peak_idx": int(peak_idx),
                "peak_price": round(peak_price, 2),
                "start_idx": int(peak_idx),
                "mid_idx": int(mid_idx),
                "end_idx": int(last_valid_idx),
                "base_high": round(base_high, 2),
                "base_low": round(base_low, 2),
                "contraction_high": round(contraction_high, 2),
                "contraction_low": round(contraction_low, 2),
                "contraction_ratio": round(contraction_ratio, 2),
                "retrace_pct": round(retrace, 3),
                "duration": int(duration),
                "breakout_level": round(float(breakout_level), 2),
                "invalid_reason": invalid_reason if invalid_reason is not None else "active_to_end_of_data",
            }
        )

    return out


def merge_overlapping_bases(candidates: list[dict], df: pd.DataFrame, contraction_tail: int = 5) -> list[dict]:
    if not candidates:
        return []

    by_peak: dict[int, dict] = {}
    for candidate in candidates:
        peak_idx = candidate["peak_idx"]
        current = by_peak.get(peak_idx)
        if current is None or candidate["end_idx"] > current["end_idx"]:
            by_peak[peak_idx] = candidate

    reps = sorted(by_peak.values(), key=lambda item: item["start_idx"])
    merged: list[dict] = []
    highs = df["high"].values
    lows = df["low"].values

    for candidate in reps:
        if not merged:
            merged.append(candidate.copy())
            continue

        last = merged[-1]
        t0 = max(last["start_idx"], candidate["start_idx"])
        t1 = min(last["end_idx"], candidate["end_idx"])
        time_overlap = max(0, t1 - t0 + 1)
        min_len = max(1, min(last["end_idx"] - last["start_idx"] + 1, candidate["end_idx"] - candidate["start_idx"] + 1))
        time_overlap_ratio = time_overlap / min_len

        p0 = max(last["base_low"], candidate["base_low"])
        p1 = min(last["base_high"], candidate["base_high"])
        price_overlap = max(0.0, p1 - p0)
        min_height = max(1e-9, min(last["base_high"] - last["base_low"], candidate["base_high"] - candidate["base_low"]))
        price_overlap_ratio = price_overlap / min_height

        if time_overlap_ratio >= 0.60 and price_overlap_ratio >= 0.60:
            new_start = min(last["start_idx"], candidate["start_idx"])
            new_end = max(last["end_idx"], candidate["end_idx"])
            new_mid = max(new_start + 1, new_end - contraction_tail + 1)
            base_high = float(np.max(highs[new_start : new_end + 1]))
            base_low = float(np.min(lows[new_start : new_end + 1]))
            contraction_high = float(np.max(highs[new_mid : new_end + 1]))
            contraction_low = float(np.min(lows[new_mid : new_end + 1]))
            contraction_ratio = (contraction_high - contraction_low) / max(base_high - base_low, 1e-9)
            merged[-1] = {
                **last,
                "start_idx": int(new_start),
                "mid_idx": int(new_mid),
                "end_idx": int(new_end),
                "base_high": round(base_high, 2),
                "base_low": round(base_low, 2),
                "contraction_high": round(contraction_high, 2),
                "contraction_low": round(contraction_low, 2),
                "contraction_ratio": round(contraction_ratio, 2),
                "duration": int(new_end - new_start + 1),
                "retrace_pct": min(last.get("retrace_pct", 1.0), candidate.get("retrace_pct", 1.0)),
            }
        else:
            merged.append(candidate.copy())

    return merged


def ensure_base_lows_are_significant_swings(df: pd.DataFrame, swings: list[SwingPoint], base_regions: list[dict]) -> list[SwingPoint]:
    lows = df["low"].values
    atr_vals = df["atr14"].values
    out = list(swings)
    existing_low_idx = {swing.index for swing in out if swing.type == "LOW"}

    for base in base_regions:
        start_idx = int(base["start_idx"])
        end_idx = int(base["end_idx"])
        if end_idx <= start_idx:
            continue
        low_idx = start_idx + int(np.argmin(lows[start_idx : end_idx + 1]))
        low_price = float(lows[low_idx])
        if low_idx in existing_low_idx:
            continue
        atr_ref = float(atr_vals[low_idx]) if np.isfinite(atr_vals[low_idx]) else 0.0
        out.append(SwingPoint(index=low_idx, price=low_price, type="LOW", atr=atr_ref, prominence=0.0))
        existing_low_idx.add(low_idx)

    out.sort(key=lambda swing: swing.index)
    return out
