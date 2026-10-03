#!/bin/bash
# Starts Hanua in the background (if it isn't already running) and opens it
# in your browser. Safe to run any number of times.
set -euo pipefail

cd "$(dirname "$0")/.."

# Shortcuts and Finder start with a bare PATH, so look where Node usually lives.
export PATH="$HOME/node-v22.14.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Can't find Node.js. Install it from https://nodejs.org and try again."
  exit 1
fi

PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
PORT=${PORT:-3000}
URL="http://localhost:$PORT"

open_browser() {
  if command -v open >/dev/null 2>&1; then open "$URL"; else echo "Open $URL in your browser."; fi
}

# Already running? Just open it.
if curl -fs "$URL/api/status" >/dev/null 2>&1; then
  open_browser
  exit 0
fi

# Install packages the first time, or when they've changed since the last install.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installing packages (first run or after an update)…"
  npm install --no-audit --no-fund
fi

mkdir -p logs
nohup node server/index.js >> logs/hanua.log 2>&1 &
echo $! > .hanua.pid

# Wait up to 15 seconds for the server to answer.
for _ in $(seq 1 30); do
  if curl -fs "$URL/api/status" >/dev/null 2>&1; then
    open_browser
    echo "Hanua is running at $URL"
    exit 0
  fi
  sleep 0.5
done

echo "Hanua didn't start. The last lines of logs/hanua.log:"
tail -n 20 logs/hanua.log
exit 1
