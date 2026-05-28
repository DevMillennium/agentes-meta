#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
API_KEY="${API_KEY:-${ADMIN_API_KEY:-}}"

echo "== Phoenix Go-Live Check =="
echo "API_BASE_URL: ${API_BASE_URL}"
echo

echo "[1/4] Health check"
curl -sf "${API_BASE_URL}/health" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps({"ok":d.get("ok"),"service":d.get("service"),"bootstrapError":d.get("bootstrapError")}, ensure_ascii=False, indent=2))'
echo

echo "[2/4] Meta status (auth required)"
if [[ -n "${API_KEY}" ]]; then
  curl -sf "${API_BASE_URL}/api/meta/status" -H "x-api-key: ${API_KEY}" | python3 -c 'import json,sys; d=json.load(sys.stdin); out={k:d.get(k) for k in ["oauthConfigured","hasAccessToken","tokenSource","marketingReady","whatsappReady","instagramReady","adAccountId","pageId","whatsappPhoneNumberId","instagramBusinessAccountId","assetsSyncedAt"]}; print(json.dumps(out, ensure_ascii=False, indent=2))'
else
  echo "API_KEY/ADMIN_API_KEY não informado; pulando /api/meta/status."
fi
echo

echo "[3/4] Production readiness (auth required)"
if [[ -n "${API_KEY}" ]]; then
  curl -sf "${API_BASE_URL}/api/meta/production-readiness" -H "x-api-key: ${API_KEY}" | python3 -c 'import json,sys; d=json.load(sys.stdin); out={"ok":d.get("ok"),"missing":d.get("missing",[]),"checks":d.get("checks",{})}; print(json.dumps(out, ensure_ascii=False, indent=2))'
else
  echo "API_KEY/ADMIN_API_KEY não informado; pulando /api/meta/production-readiness."
fi
echo

echo "[4/4] Platform overview (auth required)"
if [[ -n "${API_KEY}" ]]; then
  curl -sf "${API_BASE_URL}/api/platform/overview" -H "x-api-key: ${API_KEY}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps({"service":d.get("service"),"stats":d.get("stats"),"meta":d.get("meta")}, ensure_ascii=False, indent=2))'
else
  echo "API_KEY/ADMIN_API_KEY não informado; pulando /api/platform/overview."
fi
echo

echo "Go-live check concluído."
