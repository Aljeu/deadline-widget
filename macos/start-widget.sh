#!/bin/bash
# start-widget.sh — launch the Deadline Widget (Electron) at login via LaunchAgent.
# Calls the real Electron binary directly (NOT the node .bin shim) because
# launchd runs with a minimal PATH and cannot resolve `node` for the shebang.
FRONTEND="/Users/aljhoneagnas/Documents/Personal Projects/Deepseek/email-deadlines-widget/frontend"
cd "$FRONTEND" || exit 1
exec "$FRONTEND/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" "$FRONTEND"
