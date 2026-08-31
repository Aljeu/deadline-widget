"""api.py — local JSON API for the deadline widget (Flask, 127.0.0.1:8766).

Endpoints:
  GET  /api/health            liveness + mail state
  GET  /api/cards             active deadline cards
  POST /api/cards/<id>/check  mark done + rollback log
  POST /api/undo              restore last checked card (or by rollback_id)
  POST /api/sync              fetch Mail -> diff -> LLM extract -> insert
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import signal
import sys
from pathlib import Path

from flask import Flask, jsonify, request

import db as dbmod
import extract
import mail_fetch

HERE = Path(__file__).resolve().parent
DEFAULT_DB = HERE / "data" / "emails.db"

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

_conn = None
_mail_ok = False


def get_conn():
    return _conn


def _now() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M")


@app.after_request
def _cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return ("", 204)
    conn = get_conn()
    count = conn.execute(
        "SELECT COUNT(*) FROM deadlines WHERE status = 'active'"
    ).fetchone()[0]
    return jsonify({
        "status": "ok",
        "mail_ok": _mail_ok,
        "last_sync": dbmod.get_sync_meta(conn, "last_sync"),
        "card_count": count,
    })


@app.route("/api/cards", methods=["GET", "OPTIONS"])
def cards():
    if request.method == "OPTIONS":
        return ("", 204)
    conn = get_conn()
    return jsonify({"cards": dbmod.list_cards(conn, status="active")})


@app.route("/api/cards/<int:card_id>/check", methods=["POST", "OPTIONS"])
def check(card_id):
    if request.method == "OPTIONS":
        return ("", 204)
    conn = get_conn()
    result = dbmod.check_card(conn, card_id)
    if result is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True, "rollback_id": result["rollback_id"]})


@app.route("/api/undo", methods=["POST", "OPTIONS"])
def undo():
    if request.method == "OPTIONS":
        return ("", 204)
    conn = get_conn()
    body = request.get_json(silent=True) or {}
    rollback_id = body.get("rollback_id")
    card = dbmod.undo(conn, rollback_id=rollback_id)
    if card is None:
        return jsonify({"error": "nothing to undo"}), 404
    return jsonify({"ok": True, "card": card})


@app.route("/api/sync", methods=["POST", "OPTIONS"])
def sync():
    global _mail_ok
    if request.method == "OPTIONS":
        return ("", 204)
    conn = get_conn()

    fixture_dir = os.environ.get("DEADLINE_FIXTURES")
    if fixture_dir:
        try:
            emails = mail_fetch.load_fixtures(fixture_dir)
            fetched = len(emails)
        except Exception as exc:  # noqa: BLE001
            return jsonify({"ok": False, "error": "fixture_error", "detail": str(exc)})
    else:
        result = mail_fetch.fetch_unread(7)
        if not result.get("ok"):
            _mail_ok = False
            return jsonify({"ok": False, "error": result.get("error", "mail_error"),
                            "detail": result.get("detail", "")})
        emails = result["emails"]
        fetched = len(emails)
    _mail_ok = True

    new_emails = dbmod.insert_new_emails(conn, emails)
    if not new_emails:
        dbmod.set_sync_meta(conn, "last_sync", _now())
        return jsonify({"ok": True, "fetched": fetched, "new_emails": 0,
                        "extracted": 0, "errors": []})

    for e in new_emails:
        e["db_id"] = e["id"]  # link extracted cards back to the emails row

    cards, errors = extract.extract_deadlines(new_emails)
    inserted = dbmod.insert_deadlines(conn, cards)
    dbmod.set_sync_meta(conn, "last_sync", _now())
    return jsonify({"ok": True, "fetched": fetched, "new_emails": len(new_emails),
                    "extracted": inserted, "errors": errors})


def _suppress_dock_icon() -> None:
    """Keep the framework-Python backend out of the Dock.

    Electron spawns Python.framework's binary, which macOS registers as a
    Dock app ("Python") even though it is a headless server. Set the
    activation policy to accessory so no Dock icon appears.
    """
    try:
        from AppKit import NSApplication
        NSApplication.sharedApplication().setActivationPolicy_(1)  # accessory
    except Exception:  # noqa: BLE001 — cosmetic; never block startup
        pass


def main() -> None:
    global _conn
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--db", type=str, default=str(DEFAULT_DB))
    args = parser.parse_args()

    _suppress_dock_icon()
    _conn = dbmod.get_conn(args.db)
    dbmod.init_db(_conn)

    def _shutdown(*_a):
        try:
            _conn.close()
        finally:
            sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    print(f"[deadline-widget] API on http://127.0.0.1:{args.port}  db={args.db}", flush=True)
    app.run(host="127.0.0.1", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
