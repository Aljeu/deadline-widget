#!/bin/bash
# install.sh — install the Deadline Widget LaunchAgent so it auto-starts at login.
#
# Why a deployed copy of the script (not the repo copy):
#   macOS TCC blocks launchd-spawned processes from reading ~/Documents. The repo
#   lives at ~/Documents/..., so a LaunchAgent pointing at the repo script fails
#   with "Operation not permitted". This copies the launcher to a TCC-safe spot
#   (~/Library/Application Support/deadline-widget/) and installs the plist.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$HOME/Library/Application Support/deadline-widget"
PLIST_DST="$HOME/Library/LaunchAgents/com.deadline.widget.plist"
LABEL="com.deadline.widget"

# 1. Deploy the launcher script to a TCC-safe location.
mkdir -p "$DEPLOY_DIR"
cp "$SRC_DIR/start-widget.sh" "$DEPLOY_DIR/start-widget.sh"
chmod +x "$DEPLOY_DIR/start-widget.sh"
echo "Launcher script deployed to $DEPLOY_DIR/start-widget.sh"

# 2. Install the LaunchAgent plist.
cp "$SRC_DIR/com.deadline.widget.plist" "$PLIST_DST"
echo "LaunchAgent plist installed to $PLIST_DST"

# 3. (Re)load it. load/unload (not bootstrap) — works from non-interactive shells.
UID_NUM="$(id -u)"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load -w "$PLIST_DST"
echo "LaunchAgent loaded (gui/$UID_NUM/$LABEL)."

echo
echo "Done. The widget will now start automatically at login."
echo "Manual controls:"
echo "  start now : launchctl kickstart gui/$UID_NUM/$LABEL"
echo "  stop      : launchctl kill SIGTERM gui/$UID_NUM/$LABEL"
echo "  uninstall : launchctl unload $PLIST_DST && rm $PLIST_DST && rm -r $DEPLOY_DIR"
