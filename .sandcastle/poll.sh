#!/usr/bin/env bash
#
# Sandcastle polling dispatcher.
#
# Repeatedly checks GitHub for open issues labelled `sandcastle`. If any are
# found, invokes the main.mts pipeline which processes up to MAX_ITERATIONS
# issues in one run (implement + review per iteration). Sleeps between checks.
#
# Usage:
#   bash .sandcastle/poll.sh            # default 30s interval
#   bash .sandcastle/poll.sh 300        # poll every 5 min
#   bash .sandcastle/poll.sh 1800       # poll every 30 min
#
# Logs:
#   .sandcastle/logs/run-<timestamp>.log   per-dispatch detailed log
#   .sandcastle/logs/poll.log              high-level poll heartbeat
#
# Stop:
#   Ctrl-C in foreground, or kill the pid from `ps`.

set -euo pipefail

# Always operate from the project root so relative paths resolve consistently,
# regardless of where the user invoked this script from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

INTERVAL="${1:-30}"
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
      # The merger merged the feature branch into local main (Sandcastle syncs
      # the sandbox worktree back to host .git). Push so origin tracks reality.
      # Only push when local main is actually ahead of origin/main.
      if git fetch --quiet origin main 2>/dev/null; then
        ahead=$(git rev-list --count origin/main..main 2>/dev/null || echo 0)
        if [ "$ahead" -gt 0 ]; then
          if git push origin main >>"$run_log" 2>&1; then
            log "pushed ${ahead} commit(s) to origin/main"
          else
            log "WARN: git push origin main failed — see ${run_log}"
          fi
        fi
      fi
    else
      log "dispatch ${ts} exited non-zero — see ${run_log}"
    fi
  else
    log "no sandcastle-labelled open issues; sleeping ${INTERVAL}s"
  fi

  sleep "$INTERVAL"
done
