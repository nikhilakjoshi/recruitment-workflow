#!/usr/bin/env bash
#
# devstack.sh — bring up the full Career OS local dev stack in one terminal.
#
# Starts (in order):
#   1. Postgres + pgvector via docker compose (waits until healthy)
#   2. prisma generate (keeps the client in sync with the schema)
#   3. Next.js dev server on $PORT  -> logs/dev.log
#   4. Event tick loop (manual dispatcher) -> logs/tick.log   [unless TICK=0]
#
# Verbose service output goes to the log files. This terminal shows clean
# status lines. Tail the detailed logs on demand:
#   tail -f logs/dev.log
#   tail -f logs/tick.log
#
# Usage:
#   ./devstack.sh                  # port 4000, tick every 30s
#   PORT=4100 ./devstack.sh        # custom port
#   TICK=0 ./devstack.sh           # skip the tick loop (use the UI button instead)
#   TICK_INTERVAL=60 ./devstack.sh # slower tick
#   STOP_DB=1 ./devstack.sh        # also stop Postgres on Ctrl-C (default: leave it up)
#
# Stop everything: Ctrl-C in this terminal.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-4000}"
TICK="${TICK:-1}"
TICK_INTERVAL="${TICK_INTERVAL:-30}"
STOP_DB="${STOP_DB:-0}"
PG_CONTAINER="career-os-postgres"
LOG_DIR="logs"
DEV_LOG="$LOG_DIR/dev.log"
TICK_LOG="$LOG_DIR/tick.log"

mkdir -p "$LOG_DIR"

# ── output helpers ──────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BLUE=$'\033[34m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_DIM=""
fi
log()  { printf "%s[devstack]%s %s\n" "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf "%s[devstack]%s %s%s%s\n" "$C_BLUE" "$C_RESET" "$C_GREEN" "$*" "$C_RESET"; }
warn() { printf "%s[devstack]%s %s%s%s\n" "$C_BLUE" "$C_RESET" "$C_YELLOW" "$*" "$C_RESET"; }
die()  { printf "%s[devstack]%s %s%s%s\n" "$C_BLUE" "$C_RESET" "$C_RED" "$*" "$C_RESET" >&2; exit 1; }

DEV_PID=""
TICK_PID=""

cleanup() {
  printf "\n"
  log "shutting down..."
  [ -n "$TICK_PID" ] && kill "$TICK_PID" 2>/dev/null || true
  if [ -n "$DEV_PID" ]; then
    pkill -P "$DEV_PID" 2>/dev/null || true
    kill "$DEV_PID" 2>/dev/null || true
  fi
  # Kill any straggler still holding the port.
  local stragglers
  stragglers="$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [ -n "$stragglers" ] && kill $stragglers 2>/dev/null || true
  if [ "$STOP_DB" = "1" ]; then
    log "stopping Postgres..."
    docker compose stop >/dev/null 2>&1 || true
  else
    log "leaving Postgres running ($PG_CONTAINER). Stop with: docker compose stop"
  fi
  ok "stopped."
  exit 0
}
trap cleanup INT TERM

# ── preflight ───────────────────────────────────────────────────────────────
[ -f .env ] || die ".env not found at project root. Copy .env.example and fill it in."

if ! docker info >/dev/null 2>&1; then
  die "Docker daemon not running. Start Docker Desktop and re-run."
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  die "Port $PORT already in use. Stop the other process or run: PORT=<other> ./devstack.sh"
fi

DB_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- || true)"
case "$DB_URL" in
  *localhost:5433*|*127.0.0.1:5433*) : ;;
  *) warn "DATABASE_URL is not localhost:5433 — devstack starts a LOCAL Postgres but .env points elsewhere." ;;
esac

# ── 1. Postgres ─────────────────────────────────────────────────────────────
log "starting Postgres (docker compose up -d)..."
docker compose up -d >/dev/null 2>&1 || die "docker compose up failed."

log "waiting for Postgres to become healthy..."
for i in $(seq 1 30); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null || echo unknown)"
  [ "$status" = "healthy" ] && break
  sleep 1
  [ "$i" = "30" ] && die "Postgres did not become healthy in 30s. Check: docker compose logs postgres"
done
ok "Postgres healthy on localhost:5433"

# ── 2. prisma generate ──────────────────────────────────────────────────────
log "running prisma generate..."
if pnpm exec prisma generate >>"$DEV_LOG" 2>&1; then
  ok "prisma client generated"
else
  warn "prisma generate failed — see $DEV_LOG (continuing anyway)"
fi

# ── 3. Next.js dev server ───────────────────────────────────────────────────
: > "$DEV_LOG"
log "starting Next.js dev server on :$PORT (-> $DEV_LOG)..."
pnpm dev -- --port "$PORT" >>"$DEV_LOG" 2>&1 &
DEV_PID=$!

log "waiting for dev server to respond..."
for i in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/signin" 2>/dev/null || echo 000)"
  [ "$code" != "000" ] && break
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    die "dev server exited during startup. Check: tail -50 $DEV_LOG"
  fi
  sleep 1
  [ "$i" = "60" ] && warn "dev server slow to respond (60s); continuing — check $DEV_LOG"
done
ok "dev server up: http://localhost:$PORT"

# ── 4. tick loop ────────────────────────────────────────────────────────────
if [ "$TICK" = "1" ]; then
  : > "$TICK_LOG"
  log "starting event tick loop every ${TICK_INTERVAL}s (-> $TICK_LOG)..."
  bash scripts/tick.sh "$PORT" "$TICK_INTERVAL" >>"$TICK_LOG" 2>&1 &
  TICK_PID=$!
  ok "tick loop running (PID $TICK_PID)"
else
  warn "tick loop disabled (TICK=0) — use the 'Process events' button in the UI"
fi

# ── ready ───────────────────────────────────────────────────────────────────
printf "\n"
ok "stack is up."
printf "  %sApp:%s        http://localhost:%s\n" "$C_DIM" "$C_RESET" "$PORT"
printf "  %sWalkthrough:%s http://localhost:%s/walkthrough\n" "$C_DIM" "$C_RESET" "$PORT"
printf "  %sDev log:%s     tail -f %s\n" "$C_DIM" "$C_RESET" "$DEV_LOG"
[ "$TICK" = "1" ] && printf "  %sTick log:%s    tail -f %s\n" "$C_DIM" "$C_RESET" "$TICK_LOG"
printf "  %sStop:%s        Ctrl-C\n\n" "$C_DIM" "$C_RESET"
log "streaming status. Ctrl-C to stop everything."

# Keep the script alive; surface if either child dies.
while true; do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    warn "dev server died — see $DEV_LOG"
    cleanup
  fi
  if [ "$TICK" = "1" ] && [ -n "$TICK_PID" ] && ! kill -0 "$TICK_PID" 2>/dev/null; then
    warn "tick loop died — restarting (-> $TICK_LOG)"
    bash scripts/tick.sh "$PORT" "$TICK_INTERVAL" >>"$TICK_LOG" 2>&1 &
    TICK_PID=$!
  fi
  sleep 5
done
