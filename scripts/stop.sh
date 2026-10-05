#!/bin/bash
# Stops the Hanua server that start.sh launched.
cd "$(dirname "$0")/.."
# Kept running by macOS (scripts/agent.sh): unload it, so it stays stopped until Start Hanua or the next login
LABEL="local.hanua.server"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" && echo "Hanua stopped."
  rm -f .hanua.pid
  exit 0
fi
if [ -f .hanua.pid ] && kill "$(cat .hanua.pid)" 2>/dev/null; then
  echo "Hanua stopped."
else
  echo "Hanua wasn't running."
fi
rm -f .hanua.pid
