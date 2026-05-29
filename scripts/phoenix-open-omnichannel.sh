#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "$ROOT/.env.chatwoot" ]] && source "$ROOT/.env.chatwoot"
URL="${PHOENIX_OMNICHANNEL_URL:-http://localhost:3001}"
APP="${URL%/}/app"
echo "Phoenix Digital Omnichannel: $APP"
open "$APP" 2>/dev/null || xdg-open "$APP" 2>/dev/null || echo "$APP"
