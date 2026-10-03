#!/bin/bash
# Stops the Hanua server that start.sh launched.
cd "$(dirname "$0")/.."
if [ -f .hanua.pid ] && kill "$(cat .hanua.pid)" 2>/dev/null; then
  echo "Hanua stopped."
else
  echo "Hanua wasn't running."
fi
rm -f .hanua.pid
