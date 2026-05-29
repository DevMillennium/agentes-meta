#!/usr/bin/env bash
# Configura Meta Graph API + Chatwoot InstallationConfig para Phoenix Omnichannel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

APP_ID="${META_APP_ID:-27447238071580159}"
APP_SECRET="${META_APP_SECRET:-}"
VERIFY_TOKEN="${META_WEBHOOK_VERIFY_TOKEN:-phoenix-verify-token}"
API_VERSION="${META_API_VERSION:-v25.0}"
PUBLIC_BASE="${PHOENIX_CHATWOOT_PUBLIC_URL:-}"

if [[ -z "$APP_SECRET" ]]; then
  echo "ERRO: META_APP_SECRET ausente em .env"
  exit 1
fi

if [[ -z "$PUBLIC_BASE" ]]; then
  echo "ERRO: defina PHOENIX_CHATWOOT_PUBLIC_URL (HTTPS público apontando para Chatwoot :3001)"
  echo "  Ex.: export PHOENIX_CHATWOOT_PUBLIC_URL=https://seu-tunnel.loca.lt"
  exit 1
fi

APP_TOKEN="${APP_ID}|${APP_SECRET}"
CALLBACK_META="${PUBLIC_BASE%/}/webhooks/meta"
CALLBACK_IG="${PUBLIC_BASE%/}/webhooks/instagram"
CALLBACK_BOT="${PUBLIC_BASE%/}/bot"

echo "==> Chatwoot: InstallationConfig (container chatwoot-rails)"
docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  configs = {
    'FB_APP_ID' => '${APP_ID}',
    'FB_APP_SECRET' => '${APP_SECRET}',
    'FB_VERIFY_TOKEN' => '${VERIFY_TOKEN}',
    'IG_VERIFY_TOKEN' => '${VERIFY_TOKEN}',
    'INSTAGRAM_VERIFY_TOKEN' => '${VERIFY_TOKEN}',
    'INSTAGRAM_APP_SECRET' => '${APP_SECRET}',
    'FACEBOOK_API_VERSION' => '${API_VERSION}',
    'INSTAGRAM_API_VERSION' => '${API_VERSION}'
  }
  configs.each do |name, value|
    ic = InstallationConfig.find_or_initialize_by(name: name)
    ic.value = value
    ic.locked = false
    ic.save!
  end
  GlobalConfig.clear_cache
  puts 'InstallationConfig Meta OK'
"

echo "==> Meta: assinaturas de webhook (app-level)"
subscribe() {
  local object="$1"
  local callback="$2"
  local fields="$3"
  curl -sS -X POST "https://graph.facebook.com/${API_VERSION}/${APP_ID}/subscriptions" \
    -d "object=${object}" \
    -d "callback_url=${callback}" \
    -d "verify_token=${VERIFY_TOKEN}" \
    -d "fields=${fields}" \
    -d "access_token=${APP_TOKEN}" | python3 -m json.tool
}

subscribe "page" "$CALLBACK_META" "messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads,messaging_handovers,messaging_referrals,message_echoes,standby"
subscribe "instagram" "$CALLBACK_META" "messages,messaging_postbacks,messaging_seen,messaging_handover,messaging_referral,message_reactions"

echo "==> Meta: listar assinaturas"
curl -sS "https://graph.facebook.com/${API_VERSION}/${APP_ID}/subscriptions?access_token=${APP_TOKEN}" | python3 -m json.tool

echo "==> Teste verify local (meta)"
curl -sS "${CALLBACK_META}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=phoenix-test" || true
echo ""
echo "Concluído. Configure no Meta Developer (manual se necessário):"
echo "  OAuth redirect: ${FRONTEND_URL:-http://localhost:3001}/app/auth/signup"
echo "  Callback webhook: ${CALLBACK_META}"
