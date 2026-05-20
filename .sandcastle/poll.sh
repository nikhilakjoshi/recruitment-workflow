#!/usr/bin/env bash
#
# Sandcastle polling dispatcher.
#
# Repeatedly checks GitHub for open issues labelled `sandcastle`. If any are
# found, invokes the main.mts pipeline which processes up to MAX_ITERATIONS
# issues in one run (implement + review per iteration). Sleeps between checks.
#
# Usage:
#   bash .sandcastle/poll.sh            # default 300s (5 min) interval
#   bash .sandcastle/poll.sh 60         # poll every 60s
#   bash .sandcastle/poll.sh 1800       # poll every 30 min
#
# Logs:
#   .sandcastle/logs/run-<timestamp>.log   per-dispatch detailed log
#   .sandcastle/logs/poll.log              high-level poll heartbeat
#
# Stop:
#   Ctrl-C in foreground, or kill the pid from `ps`.

set -euo pipefail

INTERVAL="${1:-300}"
LOG_DIR=".sandcastle/logs"
POLL_LOG="$LOG_DIR/poll.log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$POLL_LOG"
}

trap 'log "polling stopped"; exit 0' INT TERM

log "starting poll loop (interval=${INTERVAL}s)"

while true; do
  count=$(gh issue list --label sandcastle --state open --json number --jq 'length' 2>/dev/null || echo 0)

  if [ "$count" -gt 0 ]; then
    ts=$(date +%Y%m%d-%H%M%S)
    run_log="$LOG_DIR/run-${ts}.log"
    log "dispatching for ${count} open issue(s) — log: ${run_log}"
    if pnpm tsx .sandcastle/main.mts >>"$run_log" 2>&1; then
      log "dispatch ${ts} completed cleanly"
    else
      log "dispatch ${ts} exited non-zero — see ${run_log}"
    fi
  else
    log "no sandcastle-labelled open issues; sleeping ${INTERVAL}s"
  fi

  sleep "$INTERVAL"
done
