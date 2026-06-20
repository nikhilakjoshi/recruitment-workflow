#!/usr/bin/env bash
#
# Local dev tick loop. Repeatedly hits /api/cron/dispatch so event-driven
# workers fire without waiting for Vercel Cron.
#
# Usage:
#   bash scripts/tick.sh                  # default: port 4000, 30s interval
#   bash scripts/tick.sh 4000 60          # custom port + interval
#
# Stop with Ctrl-C.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

PORT="${1:-4000}"
INTERVAL="${2:-30}"

if [ ! -f .env ]; then
  echo "no .env at project root" >&2
  exit 1
fi

CRON_SECRET="$(grep -E '^CRON_SECRET=' .env | head -1 | cut -d= -f2- | sed 's/^"\(.*\)"$/\1/')"

if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET missing from .env" >&2
  exit 1
fi

URL="http://localhost:${PORT}/api/cron/dispatch"

trap 'echo; echo "tick loop stopped"; exit 0' INT TERM

echo "ticking ${URL} every ${INTERVAL}s"

while true; do
  ts="$(date '+%H:%M:%S')"
  body="$(curl -sS -H "Authorization: Bearer ${CRON_SECRET}" "$URL" || echo '{"error":"curl failed"}')"
  echo "[${ts}] ${body}"
  sleep "$INTERVAL"
done
