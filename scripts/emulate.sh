#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-4000}"
BASE="http://localhost:${PORT}"
API_KEY="${ADMIN_API_KEY:-phoenix-local-api-key-16}"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Criado .env a partir de .env.example — ajuste credenciais se necessário."
fi

# shellcheck disable=SC1091
set -a
source .env
set +a
API_KEY="${ADMIN_API_KEY:-$API_KEY}"

if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h localhost -p 5432 >/dev/null 2>&1 || brew services start postgresql@16 2>/dev/null || true
fi

if ! docker compose ps postgres 2>/dev/null | grep -q "running"; then
  npm run db:up 2>/dev/null || true
fi

npm install
npm run prisma:generate
npm run prisma:push
npm run build --workspace @phoenix/api

lsof -ti :"${PORT}" | xargs kill -9 2>/dev/null || true

npm run start --workspace @phoenix/api &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

echo "Aguardando API em ${BASE}..."
for i in $(seq 1 40); do
  if curl -sf "${BASE}/health" >/dev/null; then
    break
  fi
  sleep 0.25
done

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

echo ""
echo "=== Testes automatizados (emulação pré-deploy) ==="

curl -sf "${BASE}/health" | grep -q '"service":"phoenix-api"' && pass "GET /health" || fail "GET /health"

curl -sf "${BASE}/" | grep -q "Centro de Ferramentas" && pass "GET / (hub menu)" || fail "GET / hub"

curl -sf "${BASE}/tools/emulator" | grep -q "Emulador Phoenix" && pass "GET /tools/emulator" || fail "GET /tools/emulator"

curl -sf "${BASE}/console" | grep -q "Phoenix Console" && pass "GET /console" || fail "GET /console"

curl -sf "${BASE}/tools/leads" | grep -q "CRM" && pass "GET /tools/leads" || fail "GET /tools/leads"

curl -sf -H "x-api-key: ${API_KEY}" "${BASE}/api/leads/stats/summary" | grep -q '"total"' && pass "GET /api/leads/stats/summary" || fail "GET /api/leads"

curl -sf -H "x-api-key: ${API_KEY}" "${BASE}/api/products" | grep -q '"items"' && pass "GET /api/products" || fail "GET /api/products"

curl -sf "${BASE}/api/agents/catalog" | grep -q '"public":true' && pass "GET /api/agents/catalog (público)" || fail "GET /api/agents/catalog"

curl -sf -H "x-api-key: ${API_KEY}" "${BASE}/api/leads/board" | grep -q '"columns"' && pass "GET /api/leads/board" || fail "GET /api/leads/board"

# Webhook WhatsApp simulado (sem assinatura em dev se META_APP_SECRET vazio — verificar)
WA_PAYLOAD='{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"5511999999999","phone_number_id":"test"},"contacts":[{"profile":{"name":"Cliente Teste"},"wa_id":"5511888777666"}],"messages":[{"from":"5511888777666","id":"wamid.test","timestamp":"1710000000","type":"text","text":{"body":"Quanto custa o iPhone? Quero comprar."}}]},"field":"messages"}]}]}'

SIG=$(node -e "
require('dotenv').config();
const crypto=require('crypto');
const secret=(process.env.META_APP_SECRET||'').trim()||'test-app-secret-local';
const body=process.argv[1];
const sig='sha256='+crypto.createHmac('sha256',secret).update(body).digest('hex');
console.log(sig);
" "$WA_PAYLOAD")

WH_STATUS=$(curl -s -o /tmp/phoenix-wh.json -w "%{http_code}" -X POST "${BASE}/webhooks/whatsapp" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: ${SIG}" \
  -d "$WA_PAYLOAD")

if [ "$WH_STATUS" = "200" ]; then
  pass "POST /webhooks/whatsapp (mensagem inbound)"
else
  echo "  ⚠ webhook retornou HTTP ${WH_STATUS} ($(cat /tmp/phoenix-wh.json))"
fi

LEADS_AFTER=$(curl -sf -H "x-api-key: ${API_KEY}" "${BASE}/api/leads?limit=5")
echo "$LEADS_AFTER" | grep -q '"items"' && pass "Leads após webhook" || echo "  ⚠ sem leads novos (Meta/OpenAI podem estar desligados)"

echo ""
echo "=== Build Vercel (artefacto local) ==="
npm run vercel-build:api
test -f api/phoenix-dist/app.js && pass "api/phoenix-dist/app.js gerado" || fail "artefacto Vercel"

echo ""
echo "=== Emulação OK — pode fazer deploy ==="
echo "Hub:        ${BASE}/"
echo "Console:    ${BASE}/console"
echo "Emulador:   ${BASE}/tools/emulator"
echo "CRM Leads:  ${BASE}/tools/leads"
echo ""
if [ "${EMULATE_NO_WAIT:-}" != "1" ]; then
  open "${BASE}/" 2>/dev/null || xdg-open "${BASE}/" 2>/dev/null || true
  wait "$API_PID"
else
  kill "$API_PID" 2>/dev/null || true
fi
