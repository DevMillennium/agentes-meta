#!/usr/bin/env bash
# Cola URIs OAuth na aba ativa do Chrome (Meta Facebook Login) e tenta Salvar.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
source .env 2>/dev/null || true

URIS="https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback
https://phoenix-marketing-api-millenniumomnichannel-4893s-projects.vercel.app/api/meta/oauth/callback
http://localhost:4000/api/meta/oauth/callback
http://127.0.0.1:4000/api/meta/oauth/callback"

printf '%s' "$URIS" | pbcopy
echo "✓ URIs copiadas. Ative a aba Meta Facebook Login no Chrome…"
sleep 2

osascript <<'APPLESCRIPT'
tell application "Google Chrome" to activate
delay 0.5
tell application "System Events"
  keystroke "a" using command down
  delay 0.2
  keystroke "v" using command down
  delay 0.5
  keystroke "s" using command down
end tell
APPLESCRIPT

echo "✓ Cmd+A, Cmd+V, Cmd+S enviados — confira se o campo correto estava focado."
