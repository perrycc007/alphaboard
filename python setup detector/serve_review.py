from __future__ import annotations

import contextlib
import io
import json
import re
import sys
import threading
import traceback
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

PACKAGE_ROOT = Path(__file__).resolve().parent
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from setup_detector.config import ReviewConfig
from setup_detector.review_logic import build_prompt
from setup_detector.review_runner import run_review_export
from setup_detector.review_storage import (
    ARTIFACTS_ROOT,
    discover_runs,
    get_logic_snapshot,
    load_feedback_map,
    load_job_record,
    load_notes_map,
    load_run_chart_map,
    load_run_manifest_for_ticker,
    save_feedback,
    save_job_record,
    save_logic_snapshot,
    save_note,
    utc_now_iso,
)


HOST = "127.0.0.1"
PORT = 8765

JOBS: dict[str, dict[str, object]] = {}
JOBS_LOCK = threading.Lock()


def sanitize_fragment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower()


def newest_run_id() -> str | None:
    runs = discover_runs()
    return str(runs[0]["run_id"]) if runs else None


def collect_false_positive_examples(setup_type: str, run_id: str | None = None) -> list[dict[str, object]]:
    normalized = setup_type.upper()
    feedback_map = load_feedback_map()
    manifest_cache: dict[str, dict[str, dict[str, object]]] = {}
    examples: list[dict[str, object]] = []

    for feedback in feedback_map.values():
        if str(feedback.get("setup_type", "")).upper() != normalized:
            continue
        if feedback.get("outcome") != "false_positive":
            continue

        feedback_run_id = str(feedback.get("run_id") or "").strip()
        chart_id = str(feedback.get("chart_id") or "").strip()
        if run_id and feedback_run_id != run_id:
            continue
        if not feedback_run_id or not chart_id:
            continue

        if feedback_run_id not in manifest_cache:
            manifest_cache[feedback_run_id] = load_run_chart_map(feedback_run_id)

        manifest_item = manifest_cache[feedback_run_id].get(chart_id, {})
        chart_path = str(manifest_item.get("chart_path") or "").replace("\\", "/")
        asset_url = f"http://{HOST}:{PORT}/api/assets/{quote(feedback_run_id)}/{quote(chart_path, safe='/')}" if chart_path else None

        examples.append(
            {
                "ticker": str(feedback.get("ticker") or manifest_item.get("ticker") or "").upper(),
                "run_id": feedback_run_id,
                "chart_id": chart_id,
                "setup_type": normalized,
                "reviewed_at": feedback.get("reviewed_at") or feedback.get("updated_at"),
                "notes": str(feedback.get("notes") or "").strip(),
                "chart_path": chart_path,
                "asset_url": asset_url,
            }
        )

    examples.sort(key=lambda item: str(item.get("reviewed_at") or ""))
    return examples

def filter_manifest_items(
    run_id: str,
    ticker: str | None,
    setup_type: str | None,
    reviewed: str | None,
    outcome: str | None,
) -> list[dict[str, object]]:
    items = load_run_manifest_for_ticker(run_id, ticker)
    filtered: list[dict[str, object]] = []
    setup_query = setup_type.upper() if setup_type else None
    feedback_map = load_feedback_map()
    notes_map = load_notes_map()

    for item in items:
        item_key = f"{run_id}::{item['chart_id']}"
        feedback = feedback_map.get(item_key)
        note = notes_map.get(item_key)
        if setup_query and str(item.get("setup_type", "")).upper() != setup_query:
            continue
        is_reviewed = feedback is not None
        if reviewed == "reviewed" and not is_reviewed:
            continue
        if reviewed == "unreviewed" and is_reviewed:
            continue
        if outcome and str((feedback or {}).get("outcome") or "") != outcome:
            continue

        enriched = dict(item)
        enriched["feedback"] = feedback
        enriched["note"] = note
        filtered.append(enriched)
    return filtered


def make_job_record(
    *,
    job_id: str,
    scope: str,
    run_id: str,
    ticker: str | None,
    setup_type: str | None,
    rule_version: str,
) -> dict[str, object]:
    return {
        "job_id": job_id,
        "scope": scope,
        "status": "queued",
        "run_id": run_id,
        "ticker": ticker,
        "setup_type": setup_type,
        "rule_version": rule_version,
        "started_at": None,
        "finished_at": None,
        "stdout_tail": "",
        "stderr_tail": "",
        "error": None,
        "output_run_id": None,
        "item_count": 0,
        "created_at": utc_now_iso(),
    }


def store_job(job: dict[str, object]) -> None:
    with JOBS_LOCK:
        JOBS[str(job["job_id"])] = job
    save_job_record(job)


def execute_rerun(job: dict[str, object]) -> None:
    updated = dict(job)
    updated["status"] = "running"
    updated["started_at"] = utc_now_iso()
    store_job(updated)

    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()
    try:
        config = ReviewConfig.defaults()
        config.rule_version = str(updated["rule_version"])
        rule_config_path = PACKAGE_ROOT / "rule_configs" / f"{config.rule_version}.json"
        config.apply_rule_config(rule_config_path)

        scope = str(updated["scope"])
        ticker = str(updated.get("ticker") or "").upper() or None
        setup_type = str(updated.get("setup_type") or "").upper() or None
        output_root = ARTIFACTS_ROOT / str(updated["run_id"])

        tickers = None
        setup_types = None
        if scope == "selected_ticker_setup":
            tickers = [ticker] if ticker else None
            setup_types = [setup_type] if setup_type else None
        elif scope == "selected_ticker_all":
            tickers = [ticker] if ticker else None

        with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
            result = run_review_export(
                config,
                output_root=output_root,
                setup_types=setup_types,
                tickers=tickers,
                run_id=str(updated["run_id"]),
                job_scope=scope,
            )

        updated["status"] = "completed"
        updated["finished_at"] = utc_now_iso()
        updated["stdout_tail"] = stdout_buffer.getvalue()[-4000:]
        updated["stderr_tail"] = stderr_buffer.getvalue()[-4000:]
        updated["output_run_id"] = result["run_id"]
        updated["item_count"] = result["item_count"]
        updated["error"] = None
    except Exception:
        updated["status"] = "failed"
        updated["finished_at"] = utc_now_iso()
        updated["stdout_tail"] = stdout_buffer.getvalue()[-4000:]
        updated["stderr_tail"] = (stderr_buffer.getvalue() + "\n" + traceback.format_exc())[-4000:]
        updated["error"] = traceback.format_exc()
    store_job(updated)


class ReviewHandler(BaseHTTPRequestHandler):
    server_version = "ReviewStudio/0.1"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        return

    def _send(self, status: int, payload: object, content_type: str = "application/json") -> None:
        body = payload if isinstance(payload, (bytes, bytearray)) else json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _json_body(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/health":
            self._send(200, {"ok": True})
            return

        if path == "/api/runs":
            self._send(200, {"runs": discover_runs(), "latest_run_id": newest_run_id()})
            return

        if path.startswith("/api/runs/") and path.endswith("/items"):
            parts = path.split("/")
            run_id = parts[3]
            items = filter_manifest_items(
                run_id=run_id,
                ticker=(query.get("ticker") or [None])[0],
                setup_type=(query.get("setup_type") or [None])[0],
                reviewed=(query.get("reviewed") or [None])[0],
                outcome=(query.get("outcome") or [None])[0],
            )
            self._send(200, {"items": items, "total": len(items)})
            return

        if path.startswith("/api/jobs/"):
            job_id = path.split("/")[3]
            job = load_job_record(job_id)
            if not job:
                self._send(404, {"error": "job_not_found"})
                return
            self._send(200, job)
            return

        if path.startswith("/api/logic/"):
            setup_type = path.split("/")[3]
            try:
                self._send(200, get_logic_snapshot(setup_type))
            except KeyError:
                self._send(404, {"error": "unknown_setup_type"})
            return

        if path.startswith("/api/assets/"):
            segments = path.split("/", 4)
            if len(segments) < 5:
                self._send(400, {"error": "missing_asset_path"})
                return
            run_id = segments[3]
            relative_path = unquote(segments[4]).replace("\\", "/")
            asset_path = (ARTIFACTS_ROOT / run_id / relative_path).resolve()
            run_root = (ARTIFACTS_ROOT / run_id).resolve()
            if not str(asset_path).startswith(str(run_root)):
                self._send(400, {"error": "invalid_asset_path"})
                return
            if not asset_path.exists():
                self._send(404, {"error": "asset_not_found"})
                return
            if asset_path.suffix.lower() == ".png":
                content_type = "image/png"
            elif asset_path.suffix.lower() == ".html":
                content_type = "text/html; charset=utf-8"
            else:
                content_type = "application/octet-stream"
            self._send_text(200, asset_path.read_bytes(), content_type)
            return

        self._send(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._json_body()

        if path == "/api/feedback":
            run_id = str(body.get("run_id") or "")
            chart_id = str(body.get("chart_id") or "")
            outcome = str(body.get("outcome") or "")
            if not run_id or not chart_id or outcome not in {"valid", "false_positive"}:
                self._send(400, {"error": "invalid_feedback"})
                return
            item = load_run_chart_map(run_id).get(chart_id)
            if not item:
                self._send(404, {"error": "chart_not_found"})
                return
            saved = save_feedback(
                {
                    "run_id": run_id,
                    "chart_id": chart_id,
                    "ticker": item["ticker"],
                    "setup_type": item["setup_type"],
                    "outcome": outcome,
                    "notes": str(body.get("notes") or "").strip(),
                    "reviewed_at": utc_now_iso(),
                }
            )
            save_note(
                {
                    "run_id": run_id,
                    "chart_id": chart_id,
                    "ticker": item["ticker"],
                    "setup_type": item["setup_type"],
                    "notes": str(body.get("notes") or "").strip(),
                    "saved_at": utc_now_iso(),
                }
            )
            self._send(200, {"saved": True, "feedback": saved})
            return

        if path == "/api/note":
            run_id = str(body.get("run_id") or "")
            chart_id = str(body.get("chart_id") or "")
            if not run_id or not chart_id:
                self._send(400, {"error": "invalid_note"})
                return
            item = load_run_chart_map(run_id).get(chart_id)
            if not item:
                self._send(404, {"error": "chart_not_found"})
                return
            saved = save_note(
                {
                    "run_id": run_id,
                    "chart_id": chart_id,
                    "ticker": item["ticker"],
                    "setup_type": item["setup_type"],
                    "notes": str(body.get("notes") or "").strip(),
                    "saved_at": utc_now_iso(),
                }
            )
            self._send(200, {"saved": True, "note": saved})
            return

        if path == "/api/rerun":
            scope = str(body.get("scope") or "selected_ticker_setup")
            ticker = str(body.get("ticker") or "").strip().upper() or None
            setup_type = str(body.get("setup_type") or "").strip().upper() or None
            rule_version = str(body.get("rule_version") or "python_v1")
            if scope == "selected_ticker_setup" and (not ticker or not setup_type):
                self._send(400, {"error": "ticker_and_setup_required"})
                return
            if scope == "selected_ticker_all" and not ticker:
                self._send(400, {"error": "ticker_required"})
                return

            slug_bits = ["review", scope]
            if ticker:
                slug_bits.append(sanitize_fragment(ticker))
            if setup_type:
                slug_bits.append(sanitize_fragment(setup_type))
            slug_bits.append(utc_now_iso().replace(":", "").replace("-", "").replace("+00:00", "z"))
            run_id = "-".join(bit for bit in slug_bits if bit)
            job_id = uuid.uuid4().hex[:12]
            job = make_job_record(
                job_id=job_id,
                scope=scope,
                run_id=run_id,
                ticker=ticker,
                setup_type=setup_type,
                rule_version=rule_version,
            )
            store_job(job)
            thread = threading.Thread(target=execute_rerun, args=(job,), daemon=True)
            thread.start()
            self._send(202, {"job_id": job_id, "run_id": run_id, "status": "queued"})
            return

        if path.startswith("/api/logic/") and path.endswith("/prompt"):
            setup_type = path.split("/")[3]
            try:
                snapshot = get_logic_snapshot(setup_type)
            except KeyError:
                self._send(404, {"error": "unknown_setup_type"})
                return
            action = str(body.get("action") or "explain")
            prompt = build_prompt(
                action,
                setup_type,
                snapshot,
                {
                    "ticker": body.get("ticker"),
                    "run_id": body.get("run_id"),
                    "chart_id": body.get("chart_id"),
                    "notes": body.get("notes"),
                    "false_positive_examples": collect_false_positive_examples(
                        setup_type,
                        str(body.get("run_id") or "").strip() or None,
                    ),
                },
            )
            self._send(200, {"prompt": prompt})
            return

        self._send(404, {"error": "not_found"})

    def do_PUT(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        body = self._json_body()
        if path.startswith("/api/logic/"):
            setup_type = path.split("/")[3]
            try:
                snapshot = save_logic_snapshot(setup_type, body)
            except KeyError:
                self._send(404, {"error": "unknown_setup_type"})
                return
            self._send(200, snapshot)
            return
        self._send(404, {"error": "not_found"})


def main() -> None:
    ARTIFACTS_ROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), ReviewHandler)
    print(f"Review API listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
