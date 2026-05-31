#!/usr/bin/env bash
# Automação máxima go-live Phoenix Omnichannel (sem passos manuais quando possível)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

log() { echo ""; echo "==> $*"; }

log "1/8 Sincronizar URL pública"
"$ROOT/scripts/phoenix-sync-public-url.sh"
# shellcheck disable=SC1091
source .env.chatwoot 2>/dev/null || true
source .env 2>/dev/null || true

log "2/8 Token API Chatwoot (.env)"
if [[ -z "${CHATWOOT_API_ACCESS_TOKEN:-}" ]]; then
  TOKEN=$(docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner \
    "u = User.find_by(email: 'admin@phoenixglobal.com.br') || User.first; puts u&.access_token&.token" 2>/dev/null | tail -1)
  if [[ -n "$TOKEN" && "$TOKEN" != "nil" ]]; then
    if grep -q '^CHATWOOT_API_ACCESS_TOKEN=' .env 2>/dev/null; then
      sed -i '' "s/^CHATWOOT_API_ACCESS_TOKEN=.*/CHATWOOT_API_ACCESS_TOKEN=${TOKEN}/" .env
    else
      echo "CHATWOOT_API_ACCESS_TOKEN=${TOKEN}" >>.env
    fi
    export CHATWOOT_API_ACCESS_TOKEN="$TOKEN"
    echo "CHATWOOT_API_ACCESS_TOKEN gravado em .env"
  fi
fi

log "3/8 Branding + signup SaaS"
"$ROOT/scripts/phoenix-apply-omnichannel-branding.sh" 2>&1 | tail -8

log "4/8 Captain Fernanda"
"$ROOT/scripts/phoenix-setup-captain-assistant.sh" 2>&1 | tail -10

log "5/8 Meta + webhooks + inbox (Neon)"
if [[ -n "${META_APP_SECRET:-}" ]] && [[ -n "${CHATWOOT_API_ACCESS_TOKEN:-}" ]]; then
  "$ROOT/scripts/phoenix-omnichannel-activate.sh" 2>&1 | tail -20 || {
    echo "AVISO: activate/meta falhou — continuando com estado local"
  }
else
  echo "AVISO: META_APP_SECRET ou CHATWOOT_API_ACCESS_TOKEN ausente — pulando meta-full-auto"
fi

log "6/8 Widget web (canal site)"
docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  account = Account.find(1)
  unless account.inboxes.exists?(channel_type: 'Channel::WebWidget')
    channel = Channel::WebWidget.create!(account: account, website_url: 'https://phoenixglobal.com.br')
    Inbox.create!(account: account, name: 'Chat Phoenix — Website', channel: channel)
    puts 'WEB_WIDGET criado'
  else
    puts 'WEB_WIDGET ja existe'
  end
" 2>/dev/null | tail -2

log "7/9 Seed workspace (respostas prontas, labels, automação)"
"$ROOT/scripts/phoenix-seed-workspace.sh" 2>&1 | tail -5

log "8/9 Teste E2E Messenger + Captain"
"$ROOT/scripts/phoenix-e2e-messenger-test.sh" 2>&1 | tail -25

log "9/9 Verificação final"
"$ROOT/scripts/phoenix-verify-omnichannel.sh" 2>&1

echo ""
echo "Go-live automático concluído. Veja docs/phoenix-manual-pendente.md para passos só humanos (Meta Console, DM real, domínio fixo)."
