#!/usr/bin/env bash
set -euo pipefail

WEB_PORT="${PORT:-5173}"
API_PORT="${API_PORT:-5174}"
BASE_PATH="${BASE_PATH:-/}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo ""
  echo "StageWire needs DATABASE_URL before the worker data API can start."
  echo "Add a PostgreSQL DATABASE_URL to your Codespace environment, then run: pnpm dev"
  echo ""
  exit 1
fi

cleanup() {
  trap - EXIT INT TERM
  kill 0 >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Starting StageWire API on :${API_PORT}"
PORT="${API_PORT}" pnpm --dir artifacts/api-server dev &
API_PID=$!

# Give the API build/start a moment before Vite begins proxying requests.
sleep 2

echo "Starting StageWire web app on :${WEB_PORT}"
PORT="${WEB_PORT}" API_PORT="${API_PORT}" BASE_PATH="${BASE_PATH}" pnpm --dir artifacts/stagewire dev &
WEB_PID=$!

wait -n "${API_PID}" "${WEB_PID}"
