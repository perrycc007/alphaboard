from __future__ import annotations

import numpy as np
import pandas as pd

from ..models import EntrySignal


def detect_ema20_pullback(
    df: pd.DataFrame,
    dist_atr_max: float = 1.0,
    departure_atr: float = 2.0,
    departure_window: int = 30,
    target_rr: float = 3.0,
) -> list[EntrySignal]:
    signals: list[EntrySignal] = []
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    ema20 = df["ema20"].values
    sma50 = df["sma50"].values
    atr = df["atr14"].values

    for t in range(departure_window, len(df)):
        if not all(np.isfinite(value) for value in [ema20[t], sma50[t], atr[t]]):
            continue
        if atr[t] <= 0:
            continue
        if ema20[t] <= sma50[t]:
            continue

        max_close = closes[t - departure_window : t + 1].max()
        if max_close < ema20[t] + departure_atr * atr[t]:
            continue

        dist = abs(closes[t] - ema20[t])
        if dist > dist_atr_max * atr[t]:
            continue

        touched_ema20 = lows[t] <= ema20[t] <= highs[t]
        stop = ema20[t] - 1.0 * atr[t]
        risk = closes[t] - stop
        if risk <= 0:
            continue

        signals.append(
            EntrySignal(
                index=t,
                date=df["date"].iloc[t],
                price=round(float(closes[t]), 2),
                type="EMA20_TREND_FOLLOW_BULL_PULLBACK",
                stop=round(float(stop), 2),
                target=round(float(closes[t] + risk * target_rr), 2),
                rr=target_rr,
                metadata={
                    "setup_class": "TREND_FOLLOWING_20EMA_BULL_PULLBACK",
                    "direction": "LONG",
                    "key_level": round(float(ema20[t]), 2),
                    "dist_atr": round(float(dist / atr[t]), 2),
                    "ema20": round(float(ema20[t]), 2),
                    "departure_atr": round(float((max_close - ema20[t]) / atr[t]), 2),
                    "touched_ema20": touched_ema20,
                },
            )
        )

    return signals
