#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

API_PUBLIC_URL="${API_PUBLIC_URL:-http://localhost:4000}"
WEB_APP_URL="${WEB_APP_URL:-http://localhost:3000}"
META_APP_ID="${META_APP_ID:-27447238071580159}"
META_BUSINESS_ID="${META_BUSINESS_ID:-1078327696794532}"
API_KEY="${API_KEY:-${ADMIN_API_KEY:-}}"

META_ADVANCED_URL="https://developers.facebook.com/apps/${META_APP_ID}/settings/advanced/?business_id=${META_BUSINESS_ID}"
META_FB_LOGIN_URL="https://developers.facebook.com/apps/${META_APP_ID}/fb-login/settings/?business_id=${META_BUSINESS_ID}"
META_WEBHOOKS_URL="https://developers.facebook.com/apps/${META_APP_ID}/webhooks/?business_id=${META_BUSINESS_ID}"

echo "== Phoenix Meta — validação e Chrome =="

if [[ -n "${META_APP_ID}" && -n "${META_APP_SECRET:-}" ]]; then
  APP_JSON="$(curl -sS "https://graph.facebook.com/${META_API_VERSION:-v25.0}/${META_APP_ID}?fields=id,name&access_token=${META_APP_ID}|${META_APP_SECRET}")"
  if echo "${APP_JSON}" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("id") else 1)' 2>/dev/null; then
    echo "✓ App Secret válido: $(echo "${APP_JSON}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name",""))')"
  else
    echo "✗ META_APP_SECRET inválido ou app inacessível:"
    echo "${APP_JSON}"
    exit 1
  fi
else
  echo "⚠ META_APP_ID ou META_APP_SECRET ausente no .env"
fi

if ! curl -sf "${API_PUBLIC_URL}/health" >/dev/null 2>&1; then
  echo "API offline em ${API_PUBLIC_URL} — subindo docker + dev..."
  npm run db:up 2>/dev/null || true
  npm run dev &
  DEV_PID=$!
  for _ in $(seq 1 45); do
    if curl -sf "${API_PUBLIC_URL}/health" >/dev/null 2>&1; then
      echo "✓ API online"
      break
    fi
    sleep 2
  done
  if ! curl -sf "${API_PUBLIC_URL}/health" >/dev/null 2>&1; then
    kill "${DEV_PID}" 2>/dev/null || true
    echo "✗ API não subiu a tempo. Rode: npm run dev"
    exit 1
  fi
fi

if [[ -n "${API_KEY}" ]]; then
  echo ""
  echo "--- Configuração esperada no Meta Console (cruzar com Advanced / Facebook Login) ---"
  curl -sS "${API_PUBLIC_URL}/api/meta/console-settings" -H "x-api-key: ${API_KEY}" | python3 -m json.tool 2>/dev/null || true
  echo ""
fi

CHROME_APP="Google Chrome"
if ! open -Ra "${CHROME_APP}" 2>/dev/null; then
  CHROME_APP="Chromium"
  open -Ra "${CHROME_APP}" 2>/dev/null || CHROME_APP="Safari"
fi

echo "Abrindo abas no ${CHROME_APP}..."
open -a "${CHROME_APP}" "${META_ADVANCED_URL}"
open -a "${CHROME_APP}" "${META_FB_LOGIN_URL}"
open -a "${CHROME_APP}" "${META_WEBHOOKS_URL}"
open -a "${CHROME_APP}" "${WEB_APP_URL}/login"
open -a "${CHROME_APP}" "${WEB_APP_URL}/configuracoes/meta"
open -a "${CHROME_APP}" "${API_PUBLIC_URL}/console"
open -a "${CHROME_APP}" "${API_PUBLIC_URL}/dev/emulator"

echo ""
echo "Executando OAuth automático no Chrome (Playwright)…"
npm run meta:oauth:auto
