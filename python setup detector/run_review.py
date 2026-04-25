from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = Path(__file__).resolve().parent
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from setup_detector.config import ReviewConfig
from setup_detector.review_runner import run_review_export


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Python setup detectors and export review charts")
    parser.add_argument("--tickers", help="Comma-separated list of tickers. Defaults to notebook review basket.")
    parser.add_argument("--rule-version", default="python_v1", help="Artifact/version folder name.")
    parser.add_argument("--review-years", type=int, default=5, help="Years of rolling half-year windows to evaluate.")
    parser.add_argument("--fetch-period", default="5y", help="yfinance period argument.")
    parser.add_argument("--output-root", help="Override artifact output directory.")
    parser.add_argument("--fast", action="store_true", help="Run sanity mode on a single ticker/window subset.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = ReviewConfig.defaults()
    config.rule_version = args.rule_version
    config.review_years = args.review_years
    config.fetch_period = args.fetch_period
    config.fast_sanity_mode = args.fast
    if args.tickers:
        config.review_tickers = [ticker.strip().upper() for ticker in args.tickers.split(",") if ticker.strip()]
        if config.review_tickers:
            config.sanity_ticker = config.review_tickers[0]

    rule_config_path = PACKAGE_ROOT / "rule_configs" / f"{config.rule_version}.json"
    config.apply_rule_config(rule_config_path)

    output_root = Path(args.output_root).resolve() if args.output_root else ROOT / "artifacts" / "setup_review" / config.rule_version
    output_root.mkdir(parents=True, exist_ok=True)

    run_review_export(config, output_root)


if __name__ == "__main__":
    main()
