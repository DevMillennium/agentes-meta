#!/usr/bin/env bash
set -euo pipefail

API_PUBLIC_URL="${API_PUBLIC_URL:-http://localhost:4000}"
WEB_APP_URL="${WEB_APP_URL:-http://localhost:3000}"
META_APP_DASHBOARD_URL="${META_APP_DASHBOARD_URL:-https://developers.facebook.com/apps}"
META_BUSINESS_URL="${META_BUSINESS_URL:-https://business.facebook.com}"
VERCEL_DASHBOARD_URL="${VERCEL_DASHBOARD_URL:-https://vercel.com/dashboard}"

META_APP_ID="${META_APP_ID:-27447238071580159}"
META_BUSINESS_ID="${META_BUSINESS_ID:-1078327696794532}"
META_ADVANCED_URL="https://developers.facebook.com/apps/${META_APP_ID}/settings/advanced/?business_id=${META_BUSINESS_ID}"

BROWSER="${BROWSER_APP:-Google Chrome}"
if ! open -Ra "${BROWSER}" 2>/dev/null; then
  BROWSER="Safari"
fi

open -a "${BROWSER}" "${META_ADVANCED_URL}"
open -a "${BROWSER}" "${WEB_APP_URL}/login"
open -a "${BROWSER}" "${WEB_APP_URL}/configuracoes/meta"
open -a "${BROWSER}" "${API_PUBLIC_URL}/console"
open -a "${BROWSER}" "${META_APP_DASHBOARD_URL}"
open -a "${BROWSER}" "${META_BUSINESS_URL}"
open -a "${BROWSER}" "${VERCEL_DASHBOARD_URL}"

echo "Portais operacionais abertos no ${BROWSER}."
