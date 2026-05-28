#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://phoenix-marketing-api.vercel.app}"
API_KEY="${API_KEY:-${ADMIN_API_KEY:-}}"

if [[ -z "${API_KEY}" ]]; then
  echo "Defina API_KEY (ou ADMIN_API_KEY) para executar o bootstrap Meta em produção."
  echo "Exemplo: API_KEY='sua-chave' npm run meta:bootstrap:prod"
  exit 1
fi

echo "Executando bootstrap Meta em produção: ${API_BASE_URL}"

RESPONSE="$(curl -sS -m 90 -X POST "${API_BASE_URL}/api/meta/bootstrap" -H "x-api-key: ${API_KEY}")"

python3 - <<'PY' "${RESPONSE}"
import json
import sys

raw = sys.argv[1]
try:
    data = json.loads(raw)
except Exception:
    print(raw)
    raise SystemExit(0)

readiness = data.get("readinessAfter") or data.get("readinessBefore") or {}
summary = {
    "ok": data.get("ok"),
    "message": data.get("message"),
    "oauthLoginUrl": data.get("oauthLoginUrl"),
    "missing": readiness.get("missing", []),
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
print("\n--- detalhes completos ---")
print(json.dumps(data, ensure_ascii=False, indent=2))
PY
