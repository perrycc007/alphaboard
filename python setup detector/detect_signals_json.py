from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from setup_detector.config import ReviewConfig
from setup_detector.pipeline import run_detection_pipeline


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if not np.isfinite(value):
            return None
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def _load_config(payload: dict[str, Any]) -> ReviewConfig:
    config = ReviewConfig.defaults()
    config_path = payload.get("config_path")
    if config_path:
        config.apply_rule_config(Path(config_path))
    return config


def main() -> int:
    payload = json.loads(sys.stdin.read())
    bars = payload.get("bars") or []
    if not bars:
        print(json.dumps({"signals": []}))
        return 0

    df = pd.DataFrame(bars)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])

    required = ["open", "high", "low", "close", "volume"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required bar columns: {', '.join(missing)}")
    for col in required:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=required).reset_index(drop=True)

    config = _load_config(payload)
    signals, _dfw, bases = run_detection_pipeline(df, config)

    output = []
    for setup_type, signal in signals:
        metadata = dict(signal.metadata or {})
        output.append(
            {
                "setup_type": setup_type,
                "index": int(signal.index),
                "date": signal.date.isoformat()
                if hasattr(signal.date, "isoformat")
                else str(signal.date),
                "price": float(signal.price),
                "stop": float(signal.stop),
                "target": float(signal.target),
                "rr": float(signal.rr),
                "signal_type": signal.type,
                "metadata": _jsonable(metadata),
            }
        )

    print(
        json.dumps(
            {
                "signals": output,
                "base_count": len(bases),
                "rule_version": config.rule_version,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
