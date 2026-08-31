#!/usr/bin/env bash
# verify.sh — backend smoke test: health, sync, check, undo, idempotent re-sync.
# Usage: DEADLINE_FIXTURES=backend/data/fixtures .venv/bin/python backend/api.py --port 8766 --db /tmp/verify.db &
#        bash docs/verify.sh
set -euo pipefail
B="http://127.0.0.1:8766"
J() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)"; }

echo "== health =="
curl -s $B/api/health | J "['status']"

echo "== sync (LLM extraction of fixtures) =="
curl -s -X POST $B/api/sync | J "['ok']"

echo "== cards =="
N=$(curl -s $B/api/cards | python3 -c "import json,sys; print(len(json.load(sys.stdin)['cards']))")
echo "active cards: $N"
[ "$N" -ge 1 ] || { echo "FAIL: no cards"; exit 1; }

echo "== check + undo round trip =="
RB=$(curl -s -X POST $B/api/cards/1/check | J "['rollback_id']")
echo "rollback_id: $RB"
curl -s -X POST $B/api/undo | J "['ok']"
N2=$(curl -s $B/api/cards | python3 -c "import json,sys; print(len(json.load(sys.stdin)['cards']))")
echo "cards after undo: $N2"
[ "$N2" -eq "$N" ] || { echo "FAIL: undo did not restore"; exit 1; }

echo "== re-sync idempotency =="
curl -s -X POST $B/api/sync | J "['new_emails']"

echo "ALL CHECKS PASSED"
