#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

if [[ "${PHOENIX_TARGET:-}" == "cloud" ]]; then
  API_BASE_URL="${API_BASE_URL:-${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}}"
else
  API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
fi
API_KEY="${API_KEY:-${ADMIN_API_KEY:-}}"

echo "== Phoenix Go-Live Check =="
echo "API_BASE_URL: ${API_BASE_URL}"
echo "PHOENIX_TARGET: ${PHOENIX_TARGET:-local}"
echo

echo "[1/4] Health check"
HEALTH_JSON="$(curl -sS "${API_BASE_URL}/health" 2>/dev/null || true)"
python3 - <<'PY' "${HEALTH_JSON}"
import json, sys
raw = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    d = json.loads(raw) if raw else {}
except json.JSONDecodeError:
    print("Resposta /health inválida (API indisponível ou erro 500).")
    print(raw[:400])
    raise SystemExit(0)
out = {"ok": d.get("ok"), "service": d.get("service"), "bootstrapError": d.get("bootstrapError")}
print(json.dumps(out, ensure_ascii=False, indent=2))
err = str(d.get("bootstrapError") or "")
if "localhost:5432" in err or "Can't reach database" in err:
    print("\n⚠️  CRÍTICO: DATABASE_URL na Vercel aponta para localhost.")
    print("   Defina Postgres na nuvem (Neon/Supabase/Vercel Postgres) em production.")
    print("   Enquanto isso: OAuth local → npm run meta:push-token:vercel")
PY
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
