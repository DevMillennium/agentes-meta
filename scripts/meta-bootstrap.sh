#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
API_KEY="${API_KEY:-${ADMIN_API_KEY:-}}"

if [[ -z "${API_KEY}" ]]; then
  echo "Defina API_KEY (ou ADMIN_API_KEY) para executar o bootstrap Meta."
  echo "Exemplo: API_KEY=phoenix-local-api-key-16 npm run meta:bootstrap"
  exit 1
fi

echo "Executando bootstrap Meta em ${API_BASE_URL}..."

RESPONSE="$(curl -sS -m 60 -X POST "${API_BASE_URL}/api/meta/bootstrap" -H "x-api-key: ${API_KEY}")"

python3 - <<'PY' "${RESPONSE}"
import json
import sys

raw = sys.argv[1]
try:
    data = json.loads(raw)
except Exception:
    print(raw)
    raise SystemExit(0)

summary = {
    "ok": data.get("ok"),
    "message": data.get("message"),
    "missing": (data.get("readinessAfter") or data.get("readinessBefore") or {}).get("missing", []),
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
print("\n--- detalhes completos ---")
print(json.dumps(data, ensure_ascii=False, indent=2))
PY
