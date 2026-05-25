#!/usr/bin/env bash
# FraudShield AI — startup script
# Usage:  ./start.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_ROOT="$ROOT/backend"
FRONTEND_PORT=5175
BACKEND_PORT=8002

log()  { echo -e "\033[1;32m[start]\033[0m $*"; }
err()  { echo -e "\033[1;31m[error]\033[0m $*" >&2; }

wait_for() {
  local url="$1" label="$2" tries=0
  log "Waiting for $label ..."
  until curl -sf "$url" >/dev/null 2>&1; do
    sleep 1
    tries=$((tries+1))
    [ $tries -gt 60 ] && { err "$label did not come up in 60s"; exit 1; }
  done
  log "$label is ready."
}

cleanup() {
  log "Shutting down all services ..."
  kill 0 2>/dev/null || true
}
trap cleanup EXIT

log "Starting FraudShield AI"

# 1. Free required ports
for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    log "Killing existing process on port $PORT ..."
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
done

# 2. Find virtualenv inside Fraud_Detection backend
if [ -d "$ROOT/venv" ]; then
  VENV="$ROOT/venv"
elif [ -d "$BACKEND_ROOT/venv" ]; then
  VENV="$BACKEND_ROOT/venv"
elif [ -d "$BACKEND_ROOT/.venv" ]; then
  VENV="$BACKEND_ROOT/.venv"
else
  err "No virtualenv found at $BACKEND_ROOT/venv"
  err "Create one: cd $BACKEND_ROOT && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
  exit 1
fi
log "Using virtualenv: $VENV"

# 3. Start FastAPI backend
log "Starting backend on http://localhost:$BACKEND_PORT ..."
cd "$BACKEND_ROOT"
"$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
cd "$ROOT"

wait_for "http://localhost:$BACKEND_PORT/docs" "Backend"

# 4. Start React frontend
log "Starting frontend on http://localhost:$FRONTEND_PORT ..."
cd "$ROOT/frontend"
npm run dev -- --port $FRONTEND_PORT --host 0.0.0.0 &
cd "$ROOT"

wait_for "http://localhost:$FRONTEND_PORT" "Frontend"

echo ""
echo "=============================================="
echo "       FraudShield AI — all systems up       "
echo "=============================================="
echo "  Frontend  ->  http://localhost:$FRONTEND_PORT"
echo "  Backend   ->  http://localhost:$BACKEND_PORT"
echo "  API docs  ->  http://localhost:$BACKEND_PORT/docs"
echo "  WebSocket ->  ws://localhost:$BACKEND_PORT/ws/live"
echo "=============================================="
echo ""
log "Press Ctrl+C to stop all services."

wait
