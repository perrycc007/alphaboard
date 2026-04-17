from __future__ import annotations

import numpy as np
import pandas as pd

from ..models import EntrySignal


def detect_base_ma_long(
    df: pd.DataFrame,
    base_regions: list[dict],
    dist_atr_max: float = 1.0,
    target_rr: float = 3.0,
) -> list[EntrySignal]:
    out: list[EntrySignal] = []
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    ema20 = df["ema20"].values
    sma50 = df["sma50"].values
    atr = df["atr14"].values

    in_base = np.zeros(len(df), dtype=bool)
    for base in base_regions:
        start_idx, end_idx = int(base["start_idx"]), int(base["end_idx"])
        in_base[start_idx : end_idx + 1] = True

    for t in range(1, len(df)):
        if not in_base[t]:
            continue
        if not all(np.isfinite(value) for value in [ema20[t], sma50[t], atr[t]]):
            continue
        if atr[t] <= 0:
            continue
        if closes[t] <= sma50[t]:
            continue

        touched_ema20 = lows[t] <= ema20[t] <= highs[t]
        if not touched_ema20:
            continue

        dist = abs(closes[t] - ema20[t])
        if dist > dist_atr_max * atr[t]:
            continue

        stop = float(min(ema20[t] - atr[t], np.min(lows[max(0, t - 2) : t + 1]) - 0.2 * atr[t]))
        risk = closes[t] - stop
        if risk <= 0:
            continue

        out.append(
            EntrySignal(
                index=t,
                date=df["date"].iloc[t],
                price=round(float(closes[t]), 2),
                type="BASE_MA_LONG",
                stop=round(stop, 2),
                target=round(float(closes[t] + risk * target_rr), 2),
                rr=target_rr,
                metadata={
                    "setup_class": "BASE_MA_LONG",
                    "direction": "LONG",
                    "key_level": round(float(ema20[t]), 2),
                    "ema20": round(float(ema20[t]), 2),
                    "sma50": round(float(sma50[t]), 2),
                    "dist_atr": round(float(dist / atr[t]), 2),
                    "touched_ema20": touched_ema20,
                },
            )
        )

    return out
