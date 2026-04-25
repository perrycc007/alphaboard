from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from .models import EntrySignal


SETUP_BADGE_COLORS = {
    "TREND_LONG_20EMA_PULLBACK": "#10b981",
    "TREND_LONG_20EMA_LEGACY": "#84cc16",
    "BASE_FAILURE_SHORT": "#ef4444",
    "TREND_SHORT_20EMA_RALLY": "#f97316",
    "BASE_MA_LONG": "#38bdf8",
    "BASE_REGION": "#22c55e",
    "DOUBLE_TOP": "#f43f5e",
    "DOUBLE_BOTTOM": "#22c55e",
}


def _add_base_overlay(fig: go.Figure, df_ctx: pd.DataFrame, metadata: dict) -> None:
    start_idx = metadata.get("base_start_idx")
    mid_idx = metadata.get("base_mid_idx")
    end_idx = metadata.get("base_end_idx")
    base_low = metadata.get("base_low")
    base_high = metadata.get("base_high")
    contraction_low = metadata.get("contraction_low")
    contraction_high = metadata.get("contraction_high")
    if None in [start_idx, mid_idx, end_idx, base_low, base_high, contraction_low, contraction_high]:
        return

    fig.add_shape(
        type="rect",
        x0=df_ctx["date"].iloc[int(start_idx)],
        x1=df_ctx["date"].iloc[int(end_idx)],
        y0=float(base_low),
        y1=float(base_high),
        xref="x",
        yref="y",
        line=dict(color="rgba(34,197,94,0.45)", width=1),
        fillcolor="rgba(34,197,94,0.10)",
        layer="below",
    )
    fig.add_shape(
        type="rect",
        x0=df_ctx["date"].iloc[int(mid_idx)],
        x1=df_ctx["date"].iloc[int(end_idx)],
        y0=float(contraction_low),
        y1=float(contraction_high),
        xref="x",
        yref="y",
        line=dict(color="rgba(16,185,129,0.75)", width=1),
        fillcolor="rgba(16,185,129,0.16)",
        layer="below",
    )


def build_per_setup_chart(
    df_ctx: pd.DataFrame,
    signal: EntrySignal,
    setup_type: str,
    ticker: str,
    bars_before_alert: int = 60,
    bars_after_alert: int = 20,
) -> go.Figure:
    idx = int(signal.index)
    i_start = max(0, idx - bars_before_alert)
    i_end = min(len(df_ctx) - 1, idx + bars_after_alert)
    sl = df_ctx.iloc[i_start : i_end + 1].copy()

    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.78, 0.22], vertical_spacing=0.03)
    fig.add_trace(
        go.Candlestick(
            x=sl["date"],
            open=sl["open"],
            high=sl["high"],
            low=sl["low"],
            close=sl["close"],
            name="Price",
        ),
        row=1,
        col=1,
    )

    if "ema20" in sl.columns:
        fig.add_trace(go.Scatter(x=sl["date"], y=sl["ema20"], name="EMA 20", line=dict(color="#f59e0b", width=1.5)), row=1, col=1)
    if "sma50" in sl.columns:
        fig.add_trace(go.Scatter(x=sl["date"], y=sl["sma50"], name="SMA 50", line=dict(color="#3b82f6", width=1.5)), row=1, col=1)
    if "sma200" in sl.columns:
        fig.add_trace(go.Scatter(x=sl["date"], y=sl["sma200"], name="SMA 200", line=dict(color="#ef4444", width=1.2)), row=1, col=1)

    if signal.metadata:
        _add_base_overlay(fig, df_ctx, signal.metadata)

    badge_color = SETUP_BADGE_COLORS.get(setup_type, "#a3a3a3")
    fig.add_trace(
        go.Scatter(
            x=[df_ctx["date"].iloc[idx]],
            y=[signal.price],
            mode="markers+text",
            name="Alert",
            marker=dict(symbol="circle-open", size=14, color=badge_color, line=dict(width=2.5)),
            text=[setup_type.replace("_", " ")],
            textposition="top center",
            textfont=dict(size=10, color=badge_color),
        ),
        row=1,
        col=1,
    )

    key_level = signal.metadata.get("key_level") if isinstance(signal.metadata, dict) else None
    if key_level is not None:
        fig.add_hline(y=float(key_level), line_dash="dot", line_color=badge_color, opacity=0.5, row=1, col=1)

    vol_colors = ["#22c55e" if sl["close"].iloc[i] >= sl["open"].iloc[i] else "#ef4444" for i in range(len(sl))]
    fig.add_trace(go.Bar(x=sl["date"], y=sl["volume"], name="Volume", marker_color=vol_colors, opacity=0.45), row=2, col=1)

    alert_date_str = str(signal.date)[:10] if signal.date is not None else ""
    fig.update_layout(
        title=f"{ticker} - {setup_type.replace('_', ' ')} - {alert_date_str}",
        template="plotly_dark",
        height=540,
        width=1100,
        xaxis_rangeslider_visible=False,
        showlegend=False,
        margin=dict(l=50, r=30, t=50, b=30),
    )
    fig.update_yaxes(title_text="Price", row=1, col=1)
    fig.update_yaxes(title_text="Vol", row=2, col=1)
    return fig
