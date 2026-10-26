#!/usr/bin/env bash
# Opens the app in a separate Firefox profile whose pages cannot reach any address
# other than localhost (prefs in scripts/firefox-bidi/locked.user.js). The profile
# lives outside the repository and does not affect the everyday Firefox profile.
#   scripts/open-app.sh [url] [extra Firefox arguments]
set -euo pipefail
export MSYS_NO_PATHCONV=1
winpath() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${LUNAR_FIREFOX_PROFILE:-$HOME/.lunar-dev-firefox}"
if [ -n "${FIREFOX_PATH:-}" ]; then FIREFOX="$FIREFOX_PATH"
elif [ -x "/c/Program Files/Mozilla Firefox/firefox.exe" ]; then FIREFOX="/c/Program Files/Mozilla Firefox/firefox.exe"
else FIREFOX=firefox
fi
URL="${1:-http://localhost:5173/}"
shift || true

mkdir -p "$PROFILE"
# Firefox applies user.js at every start, so the prefs cannot drift.
cp "$DIR/scripts/firefox-bidi/locked.user.js" "$PROFILE/user.js"
"$FIREFOX" --no-remote --profile "$(winpath "$PROFILE")" "$@" "$URL"
