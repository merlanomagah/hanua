#!/bin/bash
# Stops Hanua, starts it again with the latest files, and opens it in a new
# Safari window. Use this after pulling an update with GitHub Desktop.
set -euo pipefail

cd "$(dirname "$0")/.."

# Kept running by macOS (scripts/agent.sh): one command restarts it, nothing left running for Shortcuts to cut off
LABEL="local.hanua.server"
if [ -f "$HOME/Library/LaunchAgents/$LABEL.plist" ]; then
  launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 && launchctl kickstart -k "gui/$(id -u)/$LABEL"
  exec scripts/start.sh
fi

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
