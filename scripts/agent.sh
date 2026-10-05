#!/bin/bash
# Hanua as a macOS launch agent (6 Oct 2026): macOS starts it at login, starts it again if it stops, and Hanua
# restarts itself when main is updated (server/updates.js). So the Restart Hanua shortcut is only a spare.
#   scripts/agent.sh install     set it up (or refresh it) and start it
#   scripts/agent.sh uninstall   back to the old way (Start Hanua.command / npm start)
#   scripts/agent.sh status      is it set up and running?
set -euo pipefail
cd "$(dirname "$0")/.."

LABEL="local.hanua.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

case "${1:-status}" in
  install)
    NODE=$(command -v node) || { echo "Can't find Node.js."; exit 1; }
    mkdir -p logs "$HOME/Library/LaunchAgents"
    [ -d node_modules ] || npm install --no-audit --no-fund
    # an old-style Hanua from this folder would hold the port
    scripts/stop.sh >/dev/null 2>&1 || true
    cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>server/index.js</string></array>
  <key>WorkingDirectory</key><string>$PWD</string>
  <key>EnvironmentVariables</key><dict>
    <key>HANUA_AGENT</key><string>1</string>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <!-- started again whenever it stops on its own (a crash, or exit 75 = "restart me on the new code") -->
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>3</integer>
  <key>StandardOutPath</key><string>$PWD/logs/hanua.log</string>
  <key>StandardErrorPath</key><string>$PWD/logs/hanua.log</string>
</dict>
</plist>
PLIST
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Hanua is now kept running by macOS."
    ;;
  uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Hanua is no longer kept running by macOS. Start Hanua.command starts it the old way."
    ;;
  status)
    if [ ! -f "$PLIST" ]; then echo "not installed"; exit 1; fi
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then echo "installed and loaded"; else echo "installed, not loaded"; fi
    ;;
  *) echo "Use: scripts/agent.sh install | uninstall | status"; exit 1 ;;
esac
