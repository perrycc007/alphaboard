from __future__ import annotations

import pandas as pd


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr1 = df["high"] - df["low"]
    tr2 = (df["high"] - prev_close).abs()
    tr3 = (df["low"] - prev_close).abs()
    return pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)


def atr_series(df: pd.DataFrame, period: int = 14) -> pd.Series:
    return true_range(df).rolling(window=period, min_periods=period).mean()


def average_bar_size(df: pd.DataFrame, period: int = 20) -> pd.Series:
    return (df["high"] - df["low"]).rolling(window=period, min_periods=1).mean()


def add_indicators(df_in: pd.DataFrame) -> pd.DataFrame:
    out = df_in.copy()
    out["atr14"] = atr_series(out, 14)
    out["abs20"] = average_bar_size(out, 20)
    out["ema20"] = out["close"].ewm(span=20, adjust=False).mean()
    out["sma50"] = out["close"].rolling(50).mean()
    out["sma200"] = out["close"].rolling(200).mean()
    return out


def ensure_indicators(df_in: pd.DataFrame) -> pd.DataFrame:
    out = df_in.copy()
    if "atr14" not in out.columns:
        out["atr14"] = atr_series(out, 14)
    if "abs20" not in out.columns:
        out["abs20"] = average_bar_size(out, 20)
    if "ema20" not in out.columns:
        out["ema20"] = out["close"].ewm(span=20, adjust=False).mean()
    if "sma50" not in out.columns:
        out["sma50"] = out["close"].rolling(50).mean()
    if "sma200" not in out.columns:
        out["sma200"] = out["close"].rolling(200).mean()
    return out
