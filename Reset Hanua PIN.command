#!/bin/bash
# Double-click if you've forgotten Hanua's PIN. Hanua then asks you to choose a new one the next time it opens.
cd "$(dirname "$0")"
rm -f data/lock.json
echo "Hanua's PIN is cleared. Open Hanua (or reload it) and choose a new one."
echo "You can close this window."
