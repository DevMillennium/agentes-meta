#!/usr/bin/env bash
# Pipeline completo: infra + API + verificação Meta + simulação + Chatwoot
# Não altera o app Meta (URLs legadas /webhooks/instagram e /webhooks/whatsapp).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API_PID_FILE="${ROOT}/.tmp/phoenix-api.pid"
API_LOG="${ROOT}/.tmp/phoenix-api.log"
mkdir -p "${ROOT}/.tmp"

# shellcheck disable=SC1091
if [[ -f .env ]]; then set -a; source .env; set +a; fi

API_BASE="${API_PUBLIC_URL:-http://localhost:4000}"
API_BASE="${API_BASE%/}"
CHATWOOT_BASE="${CHATWOOT_BASE_URL:-http://localhost:3001}"
CHATWOOT_BASE="${CHATWOOT_BASE%/}"
VERIFY_TOKEN="${META_WEBHOOK_VERIFY_TOKEN:-phoenix-verify-token}"
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
    echo "    Encerrando processo(s) na porta ${PORT}..."
    kill $pids 2>/dev/null || true
    sleep 2
  fi
}

start_api() {
  stop_api
  echo "==> [5/7] Subindo API Phoenix (porta ${PORT})..."
  nohup npm run dev:api >"$API_LOG" 2>&1 &
  echo $! >"$API_PID_FILE"
  for _ in $(seq 1 40); do
    if curl -sf "${API_BASE}/health" >/dev/null 2>&1; then
      echo "    API pronta em ${API_BASE}"
      return 0
    fi
    sleep 1
  done
  echo "    ERRO: API não respondeu em ${API_BASE}/health"
  tail -20 "$API_LOG" || true
  exit 1
}

wait_url() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 40); do
    if curl -sfL -o /dev/null "$url" 2>/dev/null; then
      echo "    ${label} OK (${url})"
      return 0
    fi
    sleep 2
  done
  echo "    AVISO: ${label} não respondeu (${url})"
  return 1
}

echo "==> [1/7] Bootstrap Chatwoot + Phoenix (se necessário)..."
bash scripts/chatwoot-bootstrap.sh

# shellcheck disable=SC1091
set -a; source .env; set +a

echo "==> [2/7] Garantindo containers Docker..."
npm run db:up 2>/dev/null || docker start phoenix-marketing-postgres phoenix-marketing-redis 2>/dev/null || true
npm run chatwoot:up 2>/dev/null || docker start chatwoot-postgres chatwoot-redis chatwoot-rails chatwoot-sidekiq 2>/dev/null || true

echo "==> [3/7] Aguardando serviços..."
wait_url "${CHATWOOT_BASE}/" "Chatwoot UI" || true

start_api

echo "==> [6/7] Verificação webhook Meta (GET legado)..."
CHALLENGE="phoenix-auto-$(date +%s)"
VERIFY_RESP=$(curl -sf \
  "${API_BASE}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${CHALLENGE}" \
  2>/dev/null || echo "FAIL")

if [[ "$VERIFY_RESP" == "$CHALLENGE" ]]; then
  echo "    ✅ Verificação Instagram OK (challenge retornado)"
else
  echo "    ⚠️  Verificação retornou: ${VERIFY_RESP}"
fi

echo "==> [7/7] Simulando mensagem Instagram + checando Chatwoot..."
SIM_OUT=$(npx tsx scripts/simulate-meta-webhook.ts instagram 2>&1)
echo "$SIM_OUT"

if echo "$SIM_OUT" | grep -q "→ 200"; then
  echo "    ✅ POST simulado OK"
else
  echo "    ⚠️  Simulação não retornou 200"
fi

sleep 4

if [[ -n "${CHATWOOT_API_ACCESS_TOKEN:-}" ]]; then
  CW_JSON=$(curl -sf -H "api_access_token: ${CHATWOOT_API_ACCESS_TOKEN}" \
    "${CHATWOOT_BASE}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID:-1}/contacts" 2>/dev/null || echo "{}")
  CW_COUNT=$(echo "$CW_JSON" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const j=JSON.parse(d);
        const l=j.payload||[];
        console.log(Array.isArray(l)?l.length:0);
      } catch { console.log(0); }
    });
  " 2>/dev/null || echo "0")
  echo "    Contatos no Chatwoot: ${CW_COUNT}"
  if [[ "${CW_COUNT}" -gt 0 ]]; then
    echo "    ✅ Integração Chatwoot OK"
  elif [[ "${CHATWOOT_API_ACCESS_TOKEN}" == *"#{"* ]]; then
    echo "    ⚠️  Token Chatwoot inválido no .env — rode: npm run chatwoot:bootstrap"
  else
    echo "    ⚠️  Sync pendente — confira logs em .tmp/phoenix-api.log"
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Pipeline automático concluído"
echo "   API:      ${API_BASE}  (logs: ${API_LOG})"
echo "   Chatwoot: ${CHATWOOT_BASE}"
echo "   Login CW: ${ADMIN_EMAIL:-admin@phoenixglobal.com.br} / PhoenixGlobal123!"
echo "   Webhooks Meta (sem alteração no app):"
echo "     ${API_BASE}/webhooks/instagram"
echo "     ${API_BASE}/webhooks/whatsapp"
echo "   Simular de novo: npm run integracao:simular"
echo "   Parar API: kill \$(cat ${API_PID_FILE})"
echo "════════════════════════════════════════════════════════"
