#!/usr/bin/env bash
# Corrige "URL bloqueada" — abre Facebook Login no Chrome e copia URIs para a área de transferência.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

API_KEY="${ADMIN_API_KEY:-}"
META_APP_ID="${META_APP_ID:-27447238071580159}"
META_BUSINESS_ID="${META_BUSINESS_ID:-1078327696794532}"
if [[ "${PHOENIX_TARGET:-}" == "cloud" ]]; then
  API_PUBLIC_URL="${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}"
  REDIRECT="${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}/api/meta/oauth/callback"
else
  API_PUBLIC_URL="${API_PUBLIC_URL:-http://localhost:4000}"
  REDIRECT="${META_REDIRECT_URI:-${API_PUBLIC_URL}/api/meta/oauth/callback}"
fi

FB_LOGIN_URL="https://developers.facebook.com/apps/${META_APP_ID}/fb-login/settings/?business_id=${META_BUSINESS_ID}"

META_ADVANCED_URL="https://developers.facebook.com/apps/${META_APP_ID}/settings/advanced/?business_id=${META_BUSINESS_ID}"

echo "== Meta OAuth — correção de configuração =="
echo ""
echo "── 0) ERRO 'configured as a desktop app' ──"
echo "Vá em Configurações → Avançado e altere Tipo de app para: WEB"
echo "  ${META_ADVANCED_URL}"
echo "Salve. Depois continue com Facebook Login abaixo."
echo ""
echo "── 1) CONFIGURAÇÕES BÁSICAS (tela da captura) ──"
echo "Domínios do app — APENAS domínios (sem http, sem /api/...):"
echo "  localhost"
echo "  phoenixglobal.com.br"
echo "  phoenixglobalholding.com"
echo "  phoenix-marketing-api.vercel.app"
echo "  phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app"
echo ""
echo "URL do site (Site URL):"
if [[ "${PHOENIX_TARGET:-}" == "cloud" ]]; then
  echo "  ${PHOENIX_CLOUD_WEB_URL:-https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app}"
else
  echo "  http://localhost:3000"
  echo "  (produção: ${PHOENIX_CLOUD_WEB_URL:-https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app})"
fi
echo "  (NÃO use o callback OAuth como Site URL)"
echo ""
echo "REMOVA do campo Domínios do app todas as linhas como:"
echo "  http://localhost:4000/api/meta/oauth/callback  ← ERRADO aqui"
echo ""
echo "── 2) FACEBOOK LOGIN → Configurações ──"
echo "Cole em URIs de redirecionamento OAuth válidos:"
echo ""
echo "Ative também:"
echo "  ✓ Login do OAuth do cliente"
echo "  ✓ Login do OAuth na Web"
echo ""

URIS_TEXT=""
if [[ "${PHOENIX_TARGET:-}" == "cloud" ]]; then
  API_CHECK_URL="${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}"
else
  API_CHECK_URL="${PHOENIX_CLOUD_API_URL:-${API_PUBLIC_URL:-http://localhost:4000}}"
fi

if [[ -n "${API_KEY}" ]] && curl -sf "${API_CHECK_URL}/health" >/dev/null 2>&1; then
  URIS_TEXT="$(curl -sS "${API_CHECK_URL}/api/meta/console-settings" -H "x-api-key: ${API_KEY}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(d["facebookLoginSettings"]["validOAuthRedirectUris"]))')"
fi

# Lista completa (local + nuvem) — obrigatória no Meta Console
FULL_URIS="http://localhost:4000/api/meta/oauth/callback
http://127.0.0.1:4000/api/meta/oauth/callback
https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback
https://phoenix-marketing-api-millenniumomnichannel-4893s-projects.vercel.app/api/meta/oauth/callback"

if [[ -z "${URIS_TEXT}" ]]; then
  URIS_TEXT="${FULL_URIS}"
else
  URIS_TEXT="$(printf '%s\n%s' "${FULL_URIS}" "${URIS_TEXT}" | awk '!seen[$0]++')"
fi

echo "${URIS_TEXT}"
echo ""
if [[ "${PHOENIX_TARGET:-}" == "cloud" ]]; then
  echo "⚠️  URI primária de PRODUÇÃO (OAuth na Vercel):"
  echo "  ${REDIRECT}"
else
  echo "⚠️  URI que o OAuth LOCAL envia (tem que estar na lista acima):"
  echo "  http://localhost:4000/api/meta/oauth/callback"
  echo ""
  echo "URI de produção (Vercel):"
  echo "  ${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}/api/meta/oauth/callback"
fi
echo ""

if command -v pbcopy >/dev/null 2>&1; then
  printf '%s\n' "${URIS_TEXT}" | pbcopy
  echo "✓ URIs copiadas para a área de transferência (Cmd+V no Meta Console)"
fi

osascript <<APPLESCRIPT 2>/dev/null || open -a "Google Chrome" "${META_ADVANCED_URL}"
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then
    make new window
  end if
  tell front window
    make new tab with properties {URL:"${META_ADVANCED_URL}"}
    make new tab with properties {URL:"${FB_LOGIN_URL}"}
  end tell
end tell
APPLESCRIPT

echo "✓ Chrome: Avançado (tipo Web) + Facebook Login abertos"
echo ""
echo "Depois de salvar no Meta, rode: npm run meta:oauth:auto"
