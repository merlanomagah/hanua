#!/bin/bash
# Makes two small apps for the Mac's Desktop (Mel, 6 Oct 2026): "Hanua" opens it (starting it first if needed) and
# "Restart Hanua" asks it to restart. macOS asks once whether they may use the Documents folder: say OK.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"; OUT="${1:-$HOME/Desktop}"
osacompile -o "$OUT/Hanua.app" -e "do shell script \"/bin/bash '$ROOT/scripts/start.sh' >/dev/null 2>&1\""
osacompile -o "$OUT/Restart Hanua.app" -e "do shell script \"/bin/bash '$ROOT/scripts/restart.sh' >/dev/null 2>&1\""
# the lamp as their icon
TMP=$(mktemp -d); mkdir "$TMP/i.iconset"
SQ="$TMP/square.png"; W=$(sips -g pixelWidth "$ROOT/public/assets/obj/lamp-on.png" | awk '/pixelWidth/{print $2}'); H=$(sips -g pixelHeight "$ROOT/public/assets/obj/lamp-on.png" | awk '/pixelHeight/{print $2}')
M=$(( W > H ? W : H )); sips --padToHeightWidth $M $M --padColor FFFFFF "$ROOT/public/assets/obj/lamp-on.png" --out "$SQ" >/dev/null
for s in 16 32 128 256 512; do sips -z $s $s "$SQ" --out "$TMP/i.iconset/icon_${s}x${s}.png" >/dev/null; done
iconutil -c icns "$TMP/i.iconset" -o "$TMP/applet.icns"
for app in "Hanua" "Restart Hanua"; do cp "$TMP/applet.icns" "$OUT/$app.app/Contents/Resources/applet.icns"; touch "$OUT/$app.app"; done
rm -rf "$TMP"
echo "Made Hanua.app and Restart Hanua.app in $OUT"
