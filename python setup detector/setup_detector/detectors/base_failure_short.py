from __future__ import annotations

import numpy as np
import pandas as pd

from ..models import EntrySignal
from .common import price_efficiency, recent_volume_not_expanding


def detect_base_failure_rally_short(
    df: pd.DataFrame,
    dist_atr_max: float = 1.0,
    failure_lookback: int = 20,
    target_rr: float = 3.0,
) -> list[EntrySignal]:
    out: list[EntrySignal] = []
    closes = df["close"].values
    highs = df["high"].values
    volumes = df["volume"].values
    atr = df["atr14"].values
    ema20 = df["ema20"].values
    sma50 = df["sma50"].values

    for t in range(max(12, failure_lookback), len(df)):
        if not all(np.isfinite(value) for value in [atr[t], ema20[t], sma50[t]]):
            continue
        if atr[t] <= 0:
            continue

        look = slice(t - failure_lookback, t)
        broke_below_50 = bool(np.any(closes[look] < (sma50[look] - 0.25 * atr[look])))
        if not broke_below_50:
            continue
        if ema20[t] >= sma50[t]:
            continue

        recent_eff = price_efficiency(closes[t - 10 : t + 1])
        weak_eff = recent_eff < 0.35
        weak_vol = recent_volume_not_expanding(volumes, t, lookback=5)
        if not (weak_eff or weak_vol):
            continue

        dist_sma50 = abs(highs[t] - sma50[t])
        dist_ema20 = abs(highs[t] - ema20[t])
        variant = None
        pivot = None

        if dist_sma50 <= dist_atr_max * atr[t] and closes[t] < sma50[t]:
            variant = "SMA50"
            pivot = float(sma50[t])
        elif dist_ema20 <= dist_atr_max * atr[t] and closes[t] < ema20[t]:
            ema20_slope_neg = ema20[t] < ema20[max(0, t - 5)]
            if not ema20_slope_neg:
                continue
            variant = "EMA20"
            pivot = float(ema20[t])

        if variant is None or pivot is None:
            continue

        stop = pivot + 0.5 * atr[t]
        risk = stop - closes[t]
        if risk <= 0:
            continue

        out.append(
            EntrySignal(
                index=t,
                date=df["date"].iloc[t],
                price=round(float(closes[t]), 2),
                type="BASE_FAILURE_SHORT",
                stop=round(float(stop), 2),
                target=round(float(closes[t] - risk * target_rr), 2),
                rr=target_rr,
                metadata={
                    "setup_class": "BASE_FAILURE_RALLY_SHORT",
                    "direction": "SHORT",
                    "key_level": round(float(pivot), 2),
                    "ma_resistance": variant,
                    "ema20": round(float(ema20[t]), 2),
                    "sma50": round(float(sma50[t]), 2),
                    "price_efficiency_10": round(float(recent_eff), 3),
                    "weak_volume": weak_vol,
                },
            )
        )

    return out
