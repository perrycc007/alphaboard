from __future__ import annotations

import numpy as np
import pandas as pd

from ..models import EntrySignal, SwingPoint
from .common import recent_volume_not_expanding


def detect_trend_long_ema20_pullback_strict(
    df: pd.DataFrame,
    sig_swings: list[SwingPoint] | None = None,
    dist_atr_max: float = 1.0,
    departure_atr: float = 2.0,
    departure_window: int = 30,
    target_rr: float = 3.0,
) -> list[EntrySignal]:
    out: list[EntrySignal] = []
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    volumes = df["volume"].values
    ema20 = df["ema20"].values
    sma50 = df["sma50"].values
    sma200 = df["sma200"].values if "sma200" in df.columns else np.full(len(df), np.nan)
    atr = df["atr14"].values

    for t in range(departure_window, len(df)):
        if not all(np.isfinite(value) for value in [ema20[t], sma50[t], atr[t]]):
            continue
        if atr[t] <= 0:
            continue
        if ema20[t] <= sma50[t]:
            continue
        if np.isfinite(sma200[t]) and sma50[t] <= sma200[t]:
            continue

        max_close = float(np.max(closes[t - departure_window : t + 1]))
        if max_close < ema20[t] + departure_atr * atr[t]:
            continue

        dist = abs(closes[t] - ema20[t])
        if dist > dist_atr_max * atr[t]:
            continue
        if closes[t] < ema20[t]:
            continue
        if not recent_volume_not_expanding(volumes, t, lookback=3):
            continue

        if sig_swings is not None:
            recent_high = any((swing.type == "HIGH") and (t - departure_window <= swing.index < t) for swing in sig_swings)
            if not recent_high:
                continue

        touched_ema20 = lows[t] <= ema20[t] <= highs[t]
        stop = float(min(ema20[t] - atr[t], np.min(lows[max(0, t - 2) : t + 1]) - 0.2 * atr[t]))
        risk = closes[t] - stop
        if risk <= 0:
            continue

        out.append(
            EntrySignal(
                index=t,
                date=df["date"].iloc[t],
                price=round(float(closes[t]), 2),
                type="TREND_LONG_20EMA_PULLBACK",
                stop=round(stop, 2),
                target=round(float(closes[t] + risk * target_rr), 2),
                rr=target_rr,
                metadata={
                    "setup_class": "TREND_LONG_20EMA_PULLBACK_STRICT",
                    "direction": "LONG",
                    "key_level": round(float(ema20[t]), 2),
                    "ema20": round(float(ema20[t]), 2),
                    "sma50": round(float(sma50[t]), 2),
                    "dist_atr": round(float(dist / atr[t]), 2),
                    "departure_atr": round(float((max_close - ema20[t]) / atr[t]), 2),
                    "touched_ema20": touched_ema20,
                },
            )
        )

    return out
