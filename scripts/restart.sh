#!/bin/bash
# Stops Hanua, starts it again with the latest files, and opens it in a new
# Safari window. Use this after pulling an update with GitHub Desktop.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
PORT=${PORT:-3000}
URL="http://localhost:$PORT"

# Hanua restarts itself: ask it to, and wait for the fresh copy to answer. It's Hanua's own child, so this script
# (and Shortcuts, which runs it) can finish straight away without cutting anything off (6 Oct 2026).
boot() { curl -fs "$URL/api/status" 2>/dev/null | sed -n 's/.*"boot":"\([^"]*\)".*/\1/p' || true; } # empty while it restarts
BEFORE=$(boot)
if [ -n "$BEFORE" ] && curl -fs -X POST -H "X-Hanua: restart" "$URL/api/restart" >/dev/null 2>&1; then
  for _ in $(seq 1 40); do
    sleep 0.5
    NOW=$(boot)
    if [ -n "$NOW" ] && [ "$NOW" != "$BEFORE" ]; then exec scripts/start.sh; fi
  done
  echo "Hanua didn't come back. The last lines of logs/hanua.log:"; tail -n 20 logs/hanua.log; exit 1
fi

# Not running, or an older Hanua without /api/restart: stop it and start it the old way
scripts/stop.sh

# Also stop a Hanua from this folder that was started some other way (e.g. npm start).
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
PORT=${PORT:-3000}
for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  if [ "$cwd" = "$PWD" ] && ps -o command= -p "$pid" | grep -q "server/index.js"; then
    kill "$pid" && echo "Stopped the older Hanua on port $PORT."
  fi
done

# Wait up to 5 seconds for the port to free up.
for _ in $(seq 1 10); do
  lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
  sleep 0.5
done
if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Something else is using port $PORT, so Hanua can't start there."
  echo "Change PORT in .env to another number (e.g. 3001) and try again."
  exit 1
fi

scripts/start.sh
