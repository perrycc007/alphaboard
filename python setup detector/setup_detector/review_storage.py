from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

from .review_logic import build_default_snapshot, compute_source_hash


REPO_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_ROOT = REPO_ROOT / "artifacts" / "setup_review"
STATE_ROOT = ARTIFACTS_ROOT / "review_studio"
FEEDBACK_PATH = STATE_ROOT / "feedback.json"
NOTES_PATH = STATE_ROOT / "notes.json"
LOGIC_PATH = STATE_ROOT / "logic_snapshots.json"
JOB_ROOT = STATE_ROOT / "jobs"
RUN_INDEX_CACHE: dict[str, dict[str, object]] = {}
RUN_INDEX_LOCK = threading.Lock()


def ensure_state_dirs() -> None:
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    JOB_ROOT.mkdir(parents=True, exist_ok=True)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json(path: Path, fallback: object) -> object:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def normalize_chart_entry(entry: dict[str, object], run_id: str) -> dict[str, object]:
    chart_path = str(entry.get("chart_path", "")).replace("\\", "/")
    chart_type = str(entry.get("chart_type") or Path(chart_path).suffix.lstrip(".") or "png").lower()
    normalized = dict(entry)
    normalized["run_id"] = str(entry.get("run_id") or run_id)
    normalized["chart_path"] = chart_path
    normalized["chart_type"] = chart_type
    normalized["setup_type"] = str(entry.get("setup_type", "")).upper()
    normalized["ticker"] = str(entry.get("ticker", "")).upper()
    return normalized


def discover_runs() -> list[dict[str, object]]:
    ensure_state_dirs()
    runs: list[dict[str, object]] = []
    for child in ARTIFACTS_ROOT.iterdir():
        if not child.is_dir():
            continue
        manifest_path = child / "manifest.json"
        if not manifest_path.exists():
            continue
        manifest = _read_json(manifest_path, [])
        run_meta = _read_json(child / "run.json", {})
        updated_at = run_meta.get("finished_at") or run_meta.get("started_at")
        if not updated_at:
            updated_at = datetime.fromtimestamp(manifest_path.stat().st_mtime, tz=timezone.utc).isoformat()
        runs.append(
            {
                "run_id": str(run_meta.get("run_id") or child.name),
                "label": str(run_meta.get("run_id") or child.name),
                "rule_version": str(run_meta.get("rule_version") or _infer_rule_version(manifest)),
                "job_scope": str(run_meta.get("job_scope") or "legacy"),
                "item_count": int(run_meta.get("item_count") or len(manifest)),
                "started_at": run_meta.get("started_at"),
                "finished_at": run_meta.get("finished_at"),
                "updated_at": updated_at,
                "path": str(child),
            }
        )
    runs.sort(key=lambda item: str(item.get("updated_at") or ""), reverse=True)
    return runs


def _infer_rule_version(manifest: object) -> str:
    if isinstance(manifest, list) and manifest:
        first = manifest[0]
        if isinstance(first, dict) and first.get("rule_version"):
            return str(first["rule_version"])
    return "unknown"


def _manifest_signature(path: Path) -> tuple[int, int] | None:
    if not path.exists():
        return None
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


def load_run_index(run_id: str) -> dict[str, object]:
    manifest_path = ARTIFACTS_ROOT / run_id / "manifest.json"
    signature = _manifest_signature(manifest_path)
    if signature is None:
        return {"manifest": [], "by_ticker": {}, "by_chart_id": {}, "signature": None}

    with RUN_INDEX_LOCK:
        cached = RUN_INDEX_CACHE.get(run_id)
        if cached and cached.get("signature") == signature:
            return cached

    manifest = _read_json(manifest_path, [])
    if not isinstance(manifest, list):
        normalized: list[dict[str, object]] = []
    else:
        normalized = [normalize_chart_entry(entry, run_id) for entry in manifest if isinstance(entry, dict)]

    by_ticker: dict[str, list[dict[str, object]]] = {}
    by_chart_id: dict[str, dict[str, object]] = {}
    for item in normalized:
        ticker = str(item.get("ticker") or "").upper()
        chart_id = str(item.get("chart_id") or "")
        by_ticker.setdefault(ticker, []).append(item)
        if chart_id:
            by_chart_id[chart_id] = item

    indexed = {
        "manifest": normalized,
        "by_ticker": by_ticker,
        "by_chart_id": by_chart_id,
        "signature": signature,
    }
    with RUN_INDEX_LOCK:
        RUN_INDEX_CACHE[run_id] = indexed
    return indexed


def load_run_manifest(run_id: str) -> list[dict[str, object]]:
    return list(load_run_index(run_id)["manifest"])


def load_run_manifest_for_ticker(run_id: str, ticker: str | None) -> list[dict[str, object]]:
    index = load_run_index(run_id)
    manifest = index["manifest"]
    if not ticker:
        return list(manifest)

    ticker_query = ticker.strip().upper()
    if not ticker_query:
        return list(manifest)

    by_ticker = index["by_ticker"]
    exact_match = by_ticker.get(ticker_query)
    if exact_match is not None:
        return list(exact_match)

    filtered: list[dict[str, object]] = []
    for candidate_ticker, items in by_ticker.items():
        if ticker_query in candidate_ticker:
            filtered.extend(items)
    return filtered


def load_run_chart_map(run_id: str) -> dict[str, dict[str, object]]:
    return dict(load_run_index(run_id)["by_chart_id"])


def load_feedback_map() -> dict[str, dict[str, object]]:
    ensure_state_dirs()
    records = _read_json(FEEDBACK_PATH, {})
    if not isinstance(records, dict):
        return {}
    return {str(key): value for key, value in records.items() if isinstance(value, dict)}


def save_feedback(entry: dict[str, object]) -> dict[str, object]:
    records = load_feedback_map()
    key = f"{entry['run_id']}::{entry['chart_id']}"
    payload = dict(entry)
    payload["updated_at"] = utc_now_iso()
    records[key] = payload
    _write_json(FEEDBACK_PATH, records)
    return payload


def load_notes_map() -> dict[str, dict[str, object]]:
    ensure_state_dirs()
    records = _read_json(NOTES_PATH, {})
    if not isinstance(records, dict):
        return {}
    return {str(key): value for key, value in records.items() if isinstance(value, dict)}


def save_note(entry: dict[str, object]) -> dict[str, object]:
    records = load_notes_map()
    key = f"{entry['run_id']}::{entry['chart_id']}"
    payload = dict(entry)
    payload["updated_at"] = utc_now_iso()
    records[key] = payload
    _write_json(NOTES_PATH, records)
    return payload


def load_logic_snapshots() -> dict[str, dict[str, object]]:
    ensure_state_dirs()
    data = _read_json(LOGIC_PATH, {})
    if not isinstance(data, dict):
        return {}
    return {str(key): value for key, value in data.items() if isinstance(value, dict)}


def get_logic_snapshot(setup_type: str) -> dict[str, object]:
    normalized = setup_type.upper()
    data = load_logic_snapshots()
    snapshot = data.get(normalized)
    if snapshot is None:
        snapshot = build_default_snapshot(normalized)
    current_hash = compute_source_hash(normalized)
    snapshot = dict(snapshot)
    snapshot["setup_type"] = normalized
    snapshot["source_hash_current"] = current_hash
    snapshot["source_hash_match"] = snapshot.get("source_hash") == current_hash
    return snapshot


def save_logic_snapshot(setup_type: str, payload: dict[str, object]) -> dict[str, object]:
    normalized = setup_type.upper()
    data = load_logic_snapshots()
    current = get_logic_snapshot(normalized)
    next_snapshot = {
        "setup_type": normalized,
        "title": current.get("title"),
        "source_files": current.get("source_files", []),
        "source_hash": compute_source_hash(normalized),
        "summary_plain": payload.get("summary_plain") or current.get("summary_plain"),
        "trigger_conditions": payload.get("trigger_conditions") or current.get("trigger_conditions", []),
        "common_false_positives": payload.get("common_false_positives") or current.get("common_false_positives", []),
        "updated_at": utc_now_iso(),
        "origin": "manual",
    }
    data[normalized] = next_snapshot
    _write_json(LOGIC_PATH, data)
    return get_logic_snapshot(normalized)


def save_job_record(job: dict[str, object]) -> None:
    ensure_state_dirs()
    job_id = str(job["job_id"])
    _write_json(JOB_ROOT / f"{job_id}.json", job)


def load_job_record(job_id: str) -> dict[str, object] | None:
    ensure_state_dirs()
    path = JOB_ROOT / f"{job_id}.json"
    if not path.exists():
        return None
    data = _read_json(path, None)
    return data if isinstance(data, dict) else None
