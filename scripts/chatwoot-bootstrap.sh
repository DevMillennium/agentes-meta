#!/usr/bin/env bash
# Bootstrap automático: Phoenix DB + Chatwoot Docker + token + inboxes + .env
# NÃO altera o app Meta (webhooks legados /webhooks/whatsapp e /webhooks/instagram).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
if [[ -f .env ]]; then set -a; source .env; set +a; fi

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@phoenixglobal.com.br}"
# Chatwoot exige senha forte (maiúscula + especial); não reutiliza ADMIN_PASSWORD fraca.
CHATWOOT_ADMIN_PASSWORD="${CHATWOOT_ADMIN_PASSWORD:-PhoenixGlobal123!}"
CHATWOOT_BASE="${CHATWOOT_BASE_URL:-http://localhost:3001}"
CHATWOOT_SECRET="${CHATWOOT_WEBHOOK_SECRET:-$(openssl rand -hex 16)}"
API_LOCAL="${API_PUBLIC_URL:-http://localhost:4000}"

echo "==> [1/8] Dependências npm..."
npm install --silent 2>/dev/null || npm install

echo "==> [2/8] Postgres + Redis Phoenix..."
npm run db:up 2>/dev/null || docker start phoenix-marketing-postgres phoenix-marketing-redis 2>/dev/null || true

echo "==> [3/8] Prisma generate + push..."
npm run prisma:generate
npm run prisma:push

echo "==> [4/8] Chatwoot .env.chatwoot..."
if [[ ! -f .env.chatwoot ]]; then
  cp .env.chatwoot.example .env.chatwoot
  SECRET="$(openssl rand -hex 64)"
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^SECRET_KEY_BASE=.*/SECRET_KEY_BASE=${SECRET}/" .env.chatwoot
  else
    sed -i "s/^SECRET_KEY_BASE=.*/SECRET_KEY_BASE=${SECRET}/" .env.chatwoot
  fi
fi

echo "==> [5/8] Subindo Chatwoot (Docker)..."
docker compose -p chatwoot -f docker-compose.chatwoot.yml up -d

echo "    Aguardando Postgres Chatwoot..."
for _ in $(seq 1 60); do
  if docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-postgres pg_isready -U postgres -d chatwoot >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "    Preparando banco Chatwoot..."
docker compose -f docker-compose.chatwoot.yml run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare 2>/dev/null || \
  docker compose -f docker-compose.chatwoot.yml run --rm chatwoot-rails bundle exec rails db:prepare || true

echo "    Aguardando UI Chatwoot..."
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "${CHATWOOT_BASE}/"; then
    break
  fi
  sleep 3
done

echo "==> [6/8] Conta admin + API token..."
RUNNER_OUT=$(docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner \
  "email='${ADMIN_EMAIL}'; password='${CHATWOOT_ADMIN_PASSWORD}'; account = Account.first || Account.create!(name: 'Phoenix Global'); user = User.find_by(email: email); if user.nil?; user = User.new(email: email, name: 'Admin Phoenix', password: password, password_confirmation: password); user.skip_confirmation! if user.respond_to?(:skip_confirmation!); user.save!; end; AccountUser.find_or_create_by!(account_id: account.id, user_id: user.id) { |au| au.role = :administrator }; token = user.access_token || AccessToken.create!(owner: user); puts 'ACCOUNT_ID=' + account.id.to_s; puts 'API_TOKEN=' + token.token.to_s" \
  2>&1) || true

ACCOUNT_ID=$(echo "$RUNNER_OUT" | grep '^ACCOUNT_ID=' | cut -d= -f2- | tr -d '\r' || true)
API_TOKEN=$(echo "$RUNNER_OUT" | grep '^API_TOKEN=' | cut -d= -f2- | tr -d '\r' || true)

if [[ -z "$ACCOUNT_ID" || -z "$API_TOKEN" ]]; then
  echo "    Aviso: rails runner não retornou token. Verifique logs do Chatwoot."
  ACCOUNT_ID="${ACCOUNT_ID:-1}"
fi

create_inbox() {
  local name="$1"
  [[ -z "$API_TOKEN" ]] && return
  local existing
  existing=$(curl -sf -H "api_access_token: ${API_TOKEN}" \
    "${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}/inboxes" 2>/dev/null | \
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const list=j.payload||j;const x=(Array.isArray(list)?list:[]).find(i=>i.name==='${name}');console.log(x?String(x.id):'')}catch{console.log('')}})" 2>/dev/null || true)
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return
  fi
  curl -sf -X POST "${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}/inboxes" \
    -H "api_access_token: ${API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\",\"channel\":{\"type\":\"api\"}}" 2>/dev/null | \
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(String(j.id||j.payload?.id||''))}catch{console.log('')}})" 2>/dev/null || true
}

echo "==> [7/8] Inboxes + webhook Chatwoot → API..."
INBOX_IG=""
INBOX_FB=""
INBOX_WA=""
if [[ -n "$API_TOKEN" ]]; then
  INBOX_IG=$(create_inbox "Instagram (Meta)" || true)
  INBOX_FB=$(create_inbox "Facebook (Meta)" || true)
  INBOX_WA=$(create_inbox "WhatsApp (Meta)" || true)

  WEBHOOK_URL="${API_LOCAL}/webhooks/chatwoot?secret=${CHATWOOT_SECRET}"
  curl -sf -X POST "${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}/webhooks" \
    -H "api_access_token: ${API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"${WEBHOOK_URL}\",\"subscriptions\":[\"message_created\",\"conversation_updated\",\"conversation_status_changed\"]}" \
    >/dev/null 2>&1 || true
fi

echo "==> [8/8] Atualizando .env Phoenix..."
SYNC_ARGS=(
  "CHATWOOT_ENABLED=true"
  "CHATWOOT_BASE_URL=${CHATWOOT_BASE}"
  "CHATWOOT_ACCOUNT_ID=${ACCOUNT_ID}"
  "CHATWOOT_WEBHOOK_SECRET=${CHATWOOT_SECRET}"
)
[[ -n "$API_TOKEN" ]] && SYNC_ARGS+=("CHATWOOT_API_ACCESS_TOKEN=${API_TOKEN}")
[[ -n "$INBOX_IG" ]] && SYNC_ARGS+=("CHATWOOT_INBOX_ID_INSTAGRAM=${INBOX_IG}")
[[ -n "$INBOX_FB" ]] && SYNC_ARGS+=("CHATWOOT_INBOX_ID_FACEBOOK=${INBOX_FB}")
[[ -n "$INBOX_WA" ]] && SYNC_ARGS+=("CHATWOOT_INBOX_ID_WHATSAPP=${INBOX_WA}")

npx tsx scripts/sync-env-chatwoot.ts "${SYNC_ARGS[@]}"

echo ""
echo "✅ Bootstrap concluído — app Meta NÃO foi alterado."
echo "   Webhooks Meta (mesmas URLs de sempre):"
echo "     ${API_LOCAL}/webhooks/whatsapp"
echo "     ${API_LOCAL}/webhooks/instagram"
echo "   Chatwoot UI: ${CHATWOOT_BASE}"
echo "   Login Chatwoot: ${ADMIN_EMAIL} / ${CHATWOOT_ADMIN_PASSWORD}"
echo ""
echo "   Suba a API: npm run dev:api"
