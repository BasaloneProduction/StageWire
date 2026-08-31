#!/usr/bin/env bash
set -euo pipefail

WEB_PORT="${PORT:-5173}"
API_PORT="${API_PORT:-5174}"
BASE_PATH="${BASE_PATH:-/}"

cleanup() {
  trap - EXIT INT TERM
  kill 0 >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo ""
  echo "Starting StageWire in demo mode (no database required)."
  echo "Starting StageWire web app on :${WEB_PORT}"
  echo ""
  PORT="${WEB_PORT}" BASE_PATH="${BASE_PATH}" pnpm --dir artifacts/stagewire dev
  exit $?
fi

echo "Starting StageWire API on :${API_PORT}"
PORT="${API_PORT}" pnpm --dir artifacts/api-server dev &
API_PID=$!

# Give the API build/start a moment before Vite begins proxying requests.
sleep 2

echo "Starting StageWire web app on :${WEB_PORT}"
PORT="${WEB_PORT}" API_PORT="${API_PORT}" BASE_PATH="${BASE_PATH}" VITE_REAL_API=true pnpm --dir artifacts/stagewire dev &
WEB_PID=$!

wait -n "${API_PID}" "${WEB_PID}"
