from __future__ import annotations

import pandas as pd
import yfinance as yf


def fetch_ticker_history(ticker: str, period: str = "5y", interval: str = "1d") -> pd.DataFrame:
    raw = yf.Ticker(ticker).history(period=period, interval=interval)
    if raw.empty:
        raise ValueError("no data returned")
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    raw = raw[["Open", "High", "Low", "Close", "Volume"]].dropna().reset_index()
    raw.rename(columns={"Date": "date", "Datetime": "date"}, inplace=True)
    return raw.rename(
        columns={
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )


def generate_half_year_windows(df_src: pd.DataFrame, years: int = 5) -> list[tuple[pd.Timestamp, pd.Timestamp]]:
    end = pd.Timestamp(df_src["date"].max())
    start = end - pd.DateOffset(years=years)
    windows: list[tuple[pd.Timestamp, pd.Timestamp]] = []
    cursor = pd.Timestamp(start)
    while cursor < end:
        window_end = cursor + pd.DateOffset(months=6)
        windows.append((cursor, min(window_end, end)))
        cursor = window_end
    return windows
