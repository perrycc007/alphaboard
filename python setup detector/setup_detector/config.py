from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from .defaults import DEFAULT_REVIEW_TICKERS


@dataclass
class ReviewConfig:
    review_tickers: list[str]
    rule_version: str = "python_v1"
    review_years: int = 5
    fetch_period: str = "5y"
    bars_before_alert: int = 60
    bars_after_alert: int = 20
    min_window_bars: int = 80
    export_image_scale: int = 2
    fast_sanity_mode: bool = False
    sanity_ticker: str = "ENPH"
    sanity_years: int = 1
    sanity_max_windows: int = 2
    sanity_max_exports_per_window: int = 8
    sig_left: int = 3
    sig_right: int = 3
    sig_prom_atr: float = 1.5
    sig_depart_atr: float = 2.5
    sig_depart_look: int = 10
    sig_min_sep: int = 7
    ema20_dist_atr: float = 1.0
    ema20_depart_win: int = 30
    ema20_target_rr: float = 3.0

    @classmethod
    def defaults(cls) -> "ReviewConfig":
        return cls(review_tickers=list(DEFAULT_REVIEW_TICKERS))

    def apply_rule_config(self, config_path: Path) -> "ReviewConfig":
        if not config_path.exists():
            return self
        payload = json.loads(config_path.read_text())
        params = payload.get("parameters", {})
        for key, value in params.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self

    def effective_tickers(self) -> list[str]:
        if not self.fast_sanity_mode:
            return self.review_tickers
        return [self.sanity_ticker]

    def effective_years(self) -> int:
        return self.sanity_years if self.fast_sanity_mode else self.review_years

    def as_dict(self) -> dict[str, object]:
        return asdict(self)
