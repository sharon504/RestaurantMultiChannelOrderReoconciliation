#!/bin/sh
# Starts the seeded backend and the Vite demo together. The trap ensures Ctrl-C
# does not leave the API server running in the background.
set -eu

backend_pid=''
cleanup() {
  if [ -n "$backend_pid" ]; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

pnpm run demo
node dist/server.js &
backend_pid=$!
pnpm run frontend
