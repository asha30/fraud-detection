#!/bin/bash
set -e
BASE="$(cd "$(dirname "$0")" && pwd)"

echo "=================================="
echo "  FraudShield — Starting Services"
echo "=================================="

# Backend :8002
echo "[1/3] Starting backend on :8002..."
cd "$BASE"
venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload &
BACKEND_PID=$!

# Bank simulator :8000
echo "[2/3] Starting bank simulator on :8000..."
venv/bin/uvicorn bank_simulator:app --host 0.0.0.0 --port 8000 &
BANK_PID=$!

# Frontend :5173
echo "[3/3] Starting frontend on :5173..."
cd "$BASE/frontend"
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo ""
echo "=================================="
echo "  All services running:"
echo "  Bank simulator : http://localhost:8000"
echo "  Backend API    : http://localhost:8002"
echo "  Frontend UI    : http://localhost:5173"
echo ""
echo "  Open http://localhost:5173 in browser"
echo "  Click 'Start Stream' to begin"
echo "=================================="

trap "kill $BACKEND_PID $BANK_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
