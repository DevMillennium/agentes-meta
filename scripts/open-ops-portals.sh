#!/usr/bin/env bash
set -euo pipefail

API_PUBLIC_URL="${API_PUBLIC_URL:-http://localhost:4000}"
WEB_APP_URL="${WEB_APP_URL:-http://localhost:3000}"
META_APP_DASHBOARD_URL="${META_APP_DASHBOARD_URL:-https://developers.facebook.com/apps}"
META_BUSINESS_URL="${META_BUSINESS_URL:-https://business.facebook.com}"
VERCEL_DASHBOARD_URL="${VERCEL_DASHBOARD_URL:-https://vercel.com/dashboard}"

open -a "Safari" "${WEB_APP_URL}/login"
open -a "Safari" "${WEB_APP_URL}/configuracoes/meta"
open -a "Safari" "${API_PUBLIC_URL}/console"
open -a "Safari" "${API_PUBLIC_URL}/api/meta/oauth/login"
open -a "Safari" "${META_APP_DASHBOARD_URL}"
open -a "Safari" "${META_BUSINESS_URL}"
open -a "Safari" "${VERCEL_DASHBOARD_URL}"

echo "Portais operacionais abertos no Safari."
