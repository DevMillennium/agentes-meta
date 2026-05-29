#!/usr/bin/env bash
# Integração automática Phoenix Digital Agents:
# Meta (app existente) + Chatwoot + API + simulação de canais.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API_PID_FILE="${ROOT}/.tmp/phoenix-api.pid"
API_LOG="${ROOT}/.tmp/phoenix-api.log"
REPORT="${ROOT}/.tmp/integracao-report.json"
mkdir -p "${ROOT}/.tmp"

# shellcheck disable=SC1091
if [[ -f .env ]]; then set -a; source .env; set +a; fi

API_BASE="${API_PUBLIC_URL:-http://localhost:4000}"
API_BASE="${API_BASE%/}"
CHATWOOT_BASE="${CHATWOOT_BASE_URL:-http://localhost:3001}"
CHATWOOT_BASE="${CHATWOOT_BASE%/}"
KEY="${ADMIN_API_KEY:?ADMIN_API_KEY ausente}"
PORT="${PORT:-4000}"

stop_api() {
  if [[ -f "$API_PID_FILE" ]]; then
    local pid
    pid=$(cat "$API_PID_FILE" 2>/dev/null || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$API_PID_FILE"
  fi
  local pids
  pids=$(lsof -ti ":${PORT}" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    sleep 2
  fi
}

start_api() {
  stop_api
  echo "==> Subindo API Phoenix (:${PORT})..."
  nohup npm run dev:api >"$API_LOG" 2>&1 &
  echo $! >"$API_PID_FILE"
  for _ in $(seq 1 50); do
    if curl -sf "${API_BASE}/health" >/dev/null 2>&1; then
      echo "    API pronta: ${API_BASE}"
      return 0
    fi
    sleep 1
  done
  echo "    ERRO: API não respondeu"
  tail -25 "$API_LOG" || true
  exit 1
}

api_post() {
  local route="$1"
  curl -sS -X POST "${API_BASE}${route}" \
    -H "x-api-key: ${KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "{}"
}

api_get() {
  local route="$1"
  curl -sf "${API_BASE}${route}" -H "x-api-key: ${KEY}" 2>/dev/null || echo "{}"
}

echo "════════════════════════════════════════════════════════"
echo "  Phoenix Digital Agents — Integração automática"
echo "════════════════════════════════════════════════════════"

echo ""
echo "==> [1/9] Dependências..."
npm install --silent 2>/dev/null || npm install

echo ""
echo "==> [2/9] Infra Docker (Postgres, Redis, Chatwoot)..."
npm run db:up 2>/dev/null || true
npm run chatwoot:up 2>/dev/null || true

echo ""
echo "==> [3/9] Bootstrap Chatwoot + .env..."
bash scripts/chatwoot-bootstrap.sh

# shellcheck disable=SC1091
set -a; source .env; set +a

echo ""
echo "==> [4/9] Prisma + token/ativos locais → .env..."
npm run prisma:generate >/dev/null 2>&1 || true
npm run prisma:push >/dev/null 2>&1 || true
npx tsx scripts/sync-env-meta.ts 2>/dev/null || true

echo ""
echo "==> [5/9] API Phoenix..."
start_api

echo ""
echo "==> [6/9] Meta bootstrap (OAuth token + sync ativos + webhooks)..."
META_BOOT=$(api_post "/api/meta/bootstrap")
echo "$META_BOOT" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{
    const j=JSON.parse(d);
    if(j.ok) console.log('✅ Meta bootstrap OK');
    else console.log('⚠️  Meta:', j.message||JSON.stringify(j).slice(0,400));
    if(j.oauthLoginUrl) console.log('   OAuth:', j.oauthLoginUrl);
  }catch{console.log(d.slice(0,400))}
})"

npx tsx scripts/sync-env-meta.ts 2>/dev/null || true
# shellcheck disable=SC1091
set -a; source .env; set +a

# Reinicia API se token/ativos foram gravados no .env
if [[ -n "${META_ACCESS_TOKEN:-}" ]] || [[ -f .meta-assets.local.json ]]; then
  start_api
fi

echo ""
echo "==> [7/9] Readiness Meta + Chatwoot..."
READINESS=$(api_get "/api/meta/production-readiness")
echo "$READINESS" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{
    const j=JSON.parse(d);
    console.log('Meta readiness:', j.ok?'✅':'⚠️ pendente');
    if(j.checks) for(const [k,v] of Object.entries(j.checks))
      console.log(' ', k+':', v.ok?'ok':'—');
  }catch{console.log('readiness indisponível')}
})"

CW_OK="false"
if curl -sf "${CHATWOOT_BASE}/" >/dev/null 2>&1; then
  CW_OK="true"
  echo "Chatwoot UI: ✅ ${CHATWOOT_BASE}"
else
  echo "Chatwoot UI: ⚠️ offline"
fi

echo ""
echo "==> [8/9] Teste simulado 3 canais (Meta → Phoenix → Chatwoot)..."
bash scripts/test-all-channels.sh || true

echo ""
echo "==> [9/9] Relatório..."
node -e "
const fs=require('fs');
const report={
  at: new Date().toISOString(),
  api: process.env.API_PUBLIC_URL||'http://localhost:4000',
  chatwoot: process.env.CHATWOOT_BASE_URL||'http://localhost:3001',
  chatwootEnabled: process.env.CHATWOOT_ENABLED==='true',
  metaAppId: process.env.META_APP_ID||'',
  hasMetaToken: Boolean(process.env.META_ACCESS_TOKEN||''),
  pageId: process.env.META_PAGE_ID||'',
  instagramId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID||'',
  whatsappPhone: process.env.WHATSAPP_PHONE_NUMBER_ID||'',
  webhooks:{
    instagram: (process.env.API_PUBLIC_URL||'http://localhost:4000')+'/webhooks/instagram',
    whatsapp: (process.env.API_PUBLIC_URL||'http://localhost:4000')+'/webhooks/whatsapp',
    metaUnified: (process.env.API_PUBLIC_URL||'http://localhost:4000')+'/webhooks/meta',
    chatwootOut: (process.env.API_PUBLIC_URL||'http://localhost:4000')+'/webhooks/chatwoot'
  }
};
fs.writeFileSync('${REPORT}', JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
"

HAS_TOKEN="false"
if [[ -n "${META_ACCESS_TOKEN:-}" ]] || [[ -f .meta-token.local.json ]]; then
  HAS_TOKEN="true"
fi

if [[ "$HAS_TOKEN" == "false" ]]; then
  echo ""
  echo "⚠️  Meta OAuth pendente — abrindo fluxo automático..."
  npm run meta:oauth:auto 2>/dev/null &
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Integração automática concluída"
echo "   Console:  ${API_BASE}/console"
echo "   Chatwoot: ${CHATWOOT_BASE}  (npm run chatwoot:open)"
echo "   Relatório: ${REPORT}"
if [[ "$HAS_TOKEN" == "false" ]]; then
  echo "   → Conclua OAuth no Facebook e rode: npm run integracao:auto"
fi
echo "════════════════════════════════════════════════════════"
