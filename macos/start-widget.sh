#!/bin/bash
# start-widget.sh — launch the Deadline Widget (packaged .app) at login via a LaunchAgent.
# Public portable template. The Python backend + venv live OUTSIDE the .app (on-disk project
# dir); DEADLINE_PROJECT_DIR lets the packaged main.js resolve them. LSUIElement in the bundle
# Info.plist keeps it dockless.
#
# Set PROJECT_DIR to the absolute path of your local clone, or export DEADLINE_PROJECT_DIR.
PROJECT_DIR="${DEADLINE_PROJECT_DIR:-/absolute/path/to/email-deadlines-widget}"
export DEADLINE_PROJECT_DIR="$PROJECT_DIR"
exec "$PROJECT_DIR/frontend/release/mac-arm64/Deadline Widget.app/Contents/MacOS/Deadline Widget"
