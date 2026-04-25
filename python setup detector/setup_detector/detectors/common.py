from __future__ import annotations

import numpy as np


def price_efficiency(closes: np.ndarray) -> float:
    if len(closes) < 2:
        return 1.0
    net = abs(float(closes[-1] - closes[0]))
    path = float(np.abs(np.diff(closes)).sum())
    if path <= 1e-9:
        return 1.0
    return net / path


def recent_volume_not_expanding(volumes: np.ndarray, t: int, lookback: int = 5) -> bool:
    if t < 2 * lookback:
        return True
    recent = volumes[t - lookback + 1 : t + 1]
    prior = volumes[t - 2 * lookback + 1 : t - lookback + 1]
    if len(recent) < lookback or len(prior) < lookback:
        return True
    avg_recent = float(np.mean(recent))
    avg_prior = float(np.mean(prior))
    if avg_prior <= 0:
        return True
    return avg_recent <= 1.1 * avg_prior
