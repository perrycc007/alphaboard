from __future__ import annotations

import pandas as pd

from ..models import EntrySignal


def build_base_region_signals(df: pd.DataFrame, base_regions: list[dict]) -> list[EntrySignal]:
    out: list[EntrySignal] = []

    for base in base_regions:
        end_idx = int(base["end_idx"])
        out.append(
            EntrySignal(
                index=end_idx,
                date=df["date"].iloc[end_idx],
                price=round(float(base["peak_price"]), 2),
                type="BASE_REGION",
                stop=round(float(base["base_low"]), 2),
                target=round(float(base["base_high"]), 2),
                rr=0.0,
                metadata={
                    "setup_class": "BASE_REGION",
                    "direction": "LONG",
                    "key_level": round(float(base["peak_price"]), 2),
                    "base_start_idx": int(base["start_idx"]),
                    "base_mid_idx": int(base["mid_idx"]),
                    "base_end_idx": end_idx,
                    "base_high": round(float(base["base_high"]), 2),
                    "base_low": round(float(base["base_low"]), 2),
                    "contraction_high": round(float(base["contraction_high"]), 2),
                    "contraction_low": round(float(base["contraction_low"]), 2),
                    "retrace_pct": base.get("retrace_pct"),
                    "duration": base.get("duration"),
                },
            )
        )

    return out
