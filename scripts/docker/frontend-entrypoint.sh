#!/bin/sh
set -euo

cd /app/frontend

LOCKFILE="package-lock.json"
STAMP="node_modules/.package-lock.hash"
CURRENT_HASH="$(sha256sum "$LOCKFILE" | awk '{print $1}')"
SAVED_HASH=""

if [ -f "$STAMP" ]; then
  SAVED_HASH="$(cat "$STAMP")"
fi

if [ ! -d node_modules ] || [ -z "$SAVED_HASH" ] || [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
  echo "Installing npm dependencies..."
  npm ci
  mkdir -p node_modules
  printf "%s" "$CURRENT_HASH" > "$STAMP"
else
  echo "Reusing existing node_modules (lock hash unchanged)."
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
