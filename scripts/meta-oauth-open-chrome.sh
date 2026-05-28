#!/usr/bin/env bash
# Abre URL OAuth no Chrome já logado (sem esperar token).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
source .env 2>/dev/null || true

TARGET="${PHOENIX_TARGET:-local}"
if [[ "$TARGET" == "cloud" ]]; then
  API="${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}"
else
  API="${API_PUBLIC_URL:-http://localhost:4000}"
fi

LOGIN_JSON="$(curl -sS -X POST "${API}/api/auth/login" \
  -H "content-type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")"

JWT="$(echo "$LOGIN_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("accessToken",""))' 2>/dev/null || true)"
if [[ -z "$JWT" ]]; then
  echo "Login falhou em ${API}. Resposta:"
  echo "$LOGIN_JSON" | head -c 500
  exit 1
fi

OAUTH_URL="$(curl -sS "${API}/api/meta/oauth/login-url" -H "Authorization: Bearer ${JWT}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("url",""))')"

if [[ -z "$OAUTH_URL" ]]; then
  echo "Não foi possível obter URL OAuth."
  exit 1
fi

echo "Abrindo OAuth (${TARGET}):"
echo "$OAUTH_URL"

osascript <<APPLESCRIPT
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  tell front window
    make new tab with properties {URL:"${OAUTH_URL//\"/\\\"}"}
  end tell
end tell
APPLESCRIPT

echo "→ Clique Continuar/Permitir no Facebook. Depois: npm run meta:push-token:vercel"
