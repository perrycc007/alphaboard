from __future__ import annotations

import numpy as np
import pandas as pd

from .indicators import atr_series
from .models import Level, SwingPoint


def detect_fractal_pivots(df: pd.DataFrame, lookahead: int = 10) -> list[SwingPoint]:
    highs = df["high"].values
    lows = df["low"].values
    atr_vals = df["atr14"].values
    abs_vals = df["abs20"].values
    n = len(df)
    points: list[SwingPoint] = []

    for t in range(n - lookahead):
        abs_tol = abs_vals[t] if np.isfinite(abs_vals[t]) else 0.0
        atr_ref = atr_vals[t] if np.isfinite(atr_vals[t]) else abs_tol

        is_high = all(highs[i] < highs[t] - abs_tol for i in range(t + 1, t + lookahead + 1))
        if is_high:
            points.append(SwingPoint(index=t, price=float(highs[t]), type="HIGH", atr=float(atr_ref)))

        is_low = all(lows[i] > lows[t] + abs_tol for i in range(t + 1, t + lookahead + 1))
        if is_low:
            points.append(SwingPoint(index=t, price=float(lows[t]), type="LOW", atr=float(atr_ref)))

    return points


def detect_significant_swings(
    df: pd.DataFrame,
    left: int = 3,
    right: int = 3,
    atr_period: int = 14,
    prom_atr: float = 1.5,
    depart_atr: float = 2.5,
    depart_lookahead: int = 10,
    min_swing_sep: int = 7,
) -> list[SwingPoint]:
    highs = df["high"].values
    lows = df["low"].values
    atr_vals = atr_series(df, atr_period).values
    n = len(df)
    candidates: list[SwingPoint] = []

    for t in range(left, n - right):
        atr_ref = atr_vals[t]
        if not np.isfinite(atr_ref) or atr_ref <= 0:
            continue

        window = slice(t - left, t + right + 1)

        if highs[t] == highs[window].max() and all(highs[i] < highs[t] for i in range(t - left, t + right + 1) if i != t):
            local_min_low = lows[window].min()
            prominence = highs[t] - local_min_low
            if prominence >= prom_atr * atr_ref:
                dep_end = min(n, t + depart_lookahead + 1)
                min_low_after = lows[t + 1 : dep_end].min() if t + 1 < dep_end else np.inf
                if min_low_after <= highs[t] - depart_atr * atr_ref:
                    candidates.append(SwingPoint(t, float(highs[t]), "HIGH", float(atr_ref), float(prominence)))

        if lows[t] == lows[window].min() and all(lows[i] > lows[t] for i in range(t - left, t + right + 1) if i != t):
            local_max_high = highs[window].max()
            prominence = local_max_high - lows[t]
            if prominence >= prom_atr * atr_ref:
                dep_end = min(n, t + depart_lookahead + 1)
                max_high_after = highs[t + 1 : dep_end].max() if t + 1 < dep_end else -np.inf
                if max_high_after >= lows[t] + depart_atr * atr_ref:
                    candidates.append(SwingPoint(t, float(lows[t]), "LOW", float(atr_ref), float(prominence)))

    candidates.sort(key=lambda point: point.index)
    result: list[SwingPoint] = []
    for point in candidates:
        if not result:
            result.append(point)
            continue
        last = result[-1]
        if point.type == last.type and point.index - last.index <= min_swing_sep:
            keep_new = point.price > last.price if point.type == "HIGH" else point.price < last.price
            if keep_new:
                result[-1] = point
        else:
            result.append(point)
    return result


def cluster_levels(swings: list[SwingPoint], merge_pct: float = 0.015, min_touches: int = 2) -> list[Level]:
    if not swings:
        return []

    sorted_swings = sorted(swings, key=lambda swing: swing.price)
    clusters: list[list[SwingPoint]] = [[sorted_swings[0]]]

    for swing in sorted_swings[1:]:
        cluster_avg = np.mean([item.price for item in clusters[-1]])
        if abs(swing.price - cluster_avg) / cluster_avg <= merge_pct:
            clusters[-1].append(swing)
        else:
            clusters.append([swing])

    levels: list[Level] = []
    for cluster in clusters:
        if len(cluster) < min_touches:
            continue
        avg_price = float(np.mean([item.price for item in cluster]))
        high_count = sum(1 for item in cluster if item.type == "HIGH")
        low_count = sum(1 for item in cluster if item.type == "LOW")
        level_type = "RESISTANCE" if high_count >= low_count else "SUPPORT"
        levels.append(
            Level(
                price=round(avg_price, 2),
                type=level_type,
                touches=len(cluster),
                indices=[item.index for item in cluster],
            )
        )

    levels.sort(key=lambda level: level.touches, reverse=True)
    return levels


def split_swings_for_chart(
    swings: list[SwingPoint],
    df_ctx: pd.DataFrame,
    atr_buffer: float = 1.0,
) -> tuple[list[SwingPoint], list[SwingPoint], list[SwingPoint]]:
    active: list[SwingPoint] = []
    expired_high: list[SwingPoint] = []
    expired_low: list[SwingPoint] = []
    highs = df_ctx["high"].values
    lows = df_ctx["low"].values
    atr_arr = df_ctx["atr14"].values

    for swing in swings:
        if swing.index >= len(df_ctx) - 1:
            active.append(swing)
            continue

        atr_ref = swing.atr if np.isfinite(swing.atr) and swing.atr > 0 else atr_arr[swing.index]
        if not np.isfinite(atr_ref) or atr_ref <= 0:
            atr_ref = atr_arr[-1] if np.isfinite(atr_arr[-1]) and atr_arr[-1] > 0 else 0.0

        threshold = atr_buffer * atr_ref
        if swing.type == "HIGH":
            if np.any(highs[swing.index + 1 :] > swing.price + threshold):
                expired_high.append(swing)
            else:
                active.append(swing)
        else:
            if np.any(lows[swing.index + 1 :] < swing.price - threshold):
                expired_low.append(swing)
            else:
                active.append(swing)

    return active, expired_high, expired_low
