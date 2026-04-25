from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Iterable

from .charting import build_per_setup_chart
from .config import ReviewConfig
from .data import fetch_ticker_history, generate_half_year_windows
from .exporters import export_figure
from .pipeline import run_detection_pipeline


def _unique_stem(setup_type: str, signal_date: str, signal_index: int, seen: set[str]) -> str:
    stem = signal_date
    if setup_type == "BASE_REGION":
        stem = f"{signal_date}_{signal_index}"
    candidate = stem
    suffix = 1
    while candidate in seen:
        candidate = f"{stem}_{suffix}"
        suffix += 1
    seen.add(candidate)
    return candidate


def _normalize_setup_filter(setup_types: Iterable[str] | None) -> set[str] | None:
    if setup_types is None:
        return None
    normalized = {item.strip().upper() for item in setup_types if item and item.strip()}
    return normalized or None


def _window_date(value: object) -> str:
    if hasattr(value, "date"):
        return str(value.date())
    return str(value)[:10]


def run_review_export(
    config: ReviewConfig,
    output_root: Path,
    setup_types: Iterable[str] | None = None,
    tickers: Iterable[str] | None = None,
    run_id: str | None = None,
    job_scope: str | None = None,
) -> dict[str, object]:
    output_root.mkdir(parents=True, exist_ok=True)

    manifest: list[dict[str, object]] = []
    skipped_log: list[str] = []
    total_exported = 0
    selected_setup_types = _normalize_setup_filter(setup_types)
    selected_tickers = [ticker.strip().upper() for ticker in tickers] if tickers else config.effective_tickers()

    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    print(
        f"Running {len(selected_tickers)} tickers | rule={config.rule_version} | output={output_root}",
        flush=True,
    )

    for ticker_index, ticker in enumerate(selected_tickers, start=1):
        ticker_start = time.time()
        print(f"\n[{ticker_index}/{len(selected_tickers)}] Fetching {ticker}...", flush=True)
        try:
            df_ticker = fetch_ticker_history(ticker, period=config.fetch_period, interval="1d")
        except Exception as exc:
            skipped_log.append(f"{ticker}: fetch error - {exc}")
            print(f"  SKIP: {exc}", flush=True)
            continue

        windows = generate_half_year_windows(df_ticker, years=config.effective_years())
        if config.fast_sanity_mode:
            windows = windows[: config.sanity_max_windows]
        print(f"  {len(windows)} windows, {len(df_ticker)} total bars", flush=True)

        for window_index, (window_start, window_end) in enumerate(windows, start=1):
            print(
                f"    -> window {window_index}/{len(windows)} [{_window_date(window_start)} to {_window_date(window_end)}]",
                flush=True,
            )
            df_window = df_ticker[
                (df_ticker["date"] >= window_start) & (df_ticker["date"] <= window_end)
            ].reset_index(drop=True)
            if len(df_window) < config.min_window_bars:
                skipped_log.append(f"{ticker} window {window_index}: only {len(df_window)} bars")
                continue

            try:
                detections, df_enriched, _ = run_detection_pipeline(df_window, config)
            except Exception as exc:
                skipped_log.append(f"{ticker} window {window_index}: pipeline error - {exc}")
                print(f"      pipeline error: {exc}", flush=True)
                continue

            if selected_setup_types is not None:
                detections = [(setup_type, signal) for setup_type, signal in detections if setup_type.upper() in selected_setup_types]

            if config.fast_sanity_mode and len(detections) > config.sanity_max_exports_per_window:
                detections = detections[: config.sanity_max_exports_per_window]

            print(f"      detections: {len(detections)}", flush=True)
            seen_stems: set[str] = set()
            window_start_str = _window_date(window_start)
            window_end_str = _window_date(window_end)

            for detection_index, (setup_type, signal) in enumerate(detections, start=1):
                if detection_index % 10 == 1:
                    print(f"      exporting {detection_index}/{len(detections)}", flush=True)

                signal_date = signal.date.strftime("%Y-%m-%d") if hasattr(signal.date, "strftime") else str(signal.date)[:10]
                chart_stem = _unique_stem(setup_type, signal_date, int(signal.index), seen_stems)
                chart_id = f"{ticker}_{setup_type}_{chart_stem}"
                png_path = output_root / ticker / setup_type / f"{chart_stem}.png"

                fig = build_per_setup_chart(
                    df_enriched,
                    signal,
                    setup_type,
                    ticker,
                    bars_before_alert=config.bars_before_alert,
                    bars_after_alert=config.bars_after_alert,
                )
                asset_path, asset_type = export_figure(fig, png_path, scale=config.export_image_scale)
                rel_path = str(asset_path.relative_to(output_root))

                manifest.append(
                    {
                        "run_id": run_id or output_root.name,
                        "chart_id": chart_id,
                        "ticker": ticker,
                        "setup_type": setup_type,
                        "alert_date": signal_date,
                        "alert_price": round(float(signal.price), 2),
                        "window_start": window_start_str,
                        "window_end": window_end_str,
                        "rule_version": config.rule_version,
                        "chart_path": rel_path,
                        "chart_type": asset_type,
                        "direction": signal.metadata.get("direction", "LONG") if isinstance(signal.metadata, dict) else "LONG",
                    }
                )
                total_exported += 1

        ticker_exports = sum(1 for item in manifest if item["ticker"] == ticker)
        print(
            f"  Exported {ticker_exports} charts for {ticker} in {time.time() - ticker_start:.1f}s",
            flush=True,
        )

    manifest_path = output_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")

    if skipped_log:
        (output_root / "skipped.log").write_text("\n".join(skipped_log), encoding="utf-8")

    metadata = {
        "run_id": run_id or output_root.name,
        "rule_version": config.rule_version,
        "job_scope": job_scope or "manual",
        "ticker_count": len(selected_tickers),
        "setup_types": sorted(selected_setup_types) if selected_setup_types else [],
        "item_count": total_exported,
        "started_at": started_at,
        "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "config": config.as_dict(),
    }
    (output_root / "run.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"\nDone! Exported {total_exported} charts.", flush=True)
    print(f"Manifest: {manifest_path}", flush=True)
    print(f"Skipped: {len(skipped_log)}", flush=True)

    return {
        "manifest_path": manifest_path,
        "manifest": manifest,
        "skipped_log": skipped_log,
        "item_count": total_exported,
        "run_id": metadata["run_id"],
        "run_path": output_root,
        "metadata": metadata,
    }
