#!/usr/bin/env bash
# Verificação não destrutiva — confirma que Phoenix omnichannel está intacto.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${PHOENIX_OMNICHANNEL_URL:-http://localhost:3001}"
BASE="${BASE%/}"
COMPOSE="docker compose -f docker-compose.chatwoot.yml"
FAIL=0

ok() { echo "  OK  $*"; }
bad() { echo "  FAIL $*"; FAIL=1; }

echo "==> Phoenix verify (sem alterar dados)"
$COMPOSE ps chatwoot-rails 2>/dev/null | grep -q Up || bad "chatwoot-rails não está Up"

for f in \
  chatwoot/config/initializers/phoenix_facebook_pages.rb \
  chatwoot/app/views/phoenix/welcome/business_pages.html.erb \
  chatwoot/public/brand-assets/phoenix-facebook-inbox.js \
  chatwoot/app/views/api/v1/accounts/callbacks/facebook_pages.json.jbuilder; do
  [[ -f "$ROOT/$f" ]] && ok "host: $f" || bad "falta no host: $f"
done

$COMPOSE exec -T chatwoot-rails sh -c '
  test -f /app/config/initializers/phoenix_facebook_pages.rb &&
  test -f /app/public/brand-assets/phoenix-facebook-inbox.js &&
  grep -q paginas-business /app/config/routes.rb
' >/dev/null 2>&1 && ok "volumes montados no container" || bad "volumes Phoenix no container"

for path in /health / /comecar/canais /comecar/paginas-business /comecar/integracoes /comecar/widget /app/login; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}${path}" || echo "000")
  [[ "$code" =~ ^(200|302)$ ]] && ok "HTTP ${code} ${path}" || bad "HTTP ${code} ${path}"
done

$COMPOSE exec -T chatwoot-rails bundle exec rails runner "
  fb = Inbox.where(channel_type: 'Channel::FacebookPage').count
  api = Inbox.where(channel_type: 'Channel::Api').count
  name = InstallationConfig.find_by(name: 'INSTALLATION_NAME')&.value
  puts \"INBOX_FB=#{fb} INBOX_API=#{api} INSTALLATION=#{name}\"
" 2>/dev/null | tail -1 | while IFS= read -r line; do
  echo "  $line"
  echo "$line" | grep -q 'INBOX_FB=0' && bad "nenhuma caixa FacebookPage (Meta)"
  echo "$line" | grep -q 'Phoenix Digital' && ok "branding INSTALLATION_NAME" || bad "INSTALLATION_NAME inesperado"
done

$COMPOSE exec -T chatwoot-rails bundle exec rails runner "
  key = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_API_KEY')&.value
  a = Captain::Assistant.joins(:captain_inboxes).distinct.count rescue 0
  puts \"CAPTAIN_KEY=#{key.present? ? 'sim' : 'nao'} CAPTAIN_INBOX_LINK=#{a}\"
" 2>/dev/null | tail -1 | while IFS= read -r line; do
  echo "  $line"
  echo "$line" | grep -q 'CAPTAIN_KEY=sim' && ok "Captain OpenAI key" || bad "Captain sem API key (rode ./phoenix captain)"
  echo "$line" | grep -q 'CAPTAIN_INBOX_LINK=[1-9]' && ok "Captain ligado a inbox" || bad "Captain sem inbox (rode ./phoenix captain)"
done

CR=$(docker exec agente-chatwoot-postgres-1 psql -U postgres -d chatwoot -t -A -c 'SELECT COUNT(*) FROM canned_responses;' 2>/dev/null | tr -d ' ')
AR=$(docker exec agente-chatwoot-postgres-1 psql -U postgres -d chatwoot -t -A -c 'SELECT COUNT(*) FROM automation_rules;' 2>/dev/null | tr -d ' ')
[[ "${CR:-0}" -gt 0 ]] && ok "respostas prontas: ${CR}" || bad "sem respostas prontas — rode ./phoenix seed"
[[ "${AR:-0}" -gt 0 ]] && ok "regras de automação: ${AR}" || bad "sem automação — rode ./phoenix seed"

CONV=$(docker exec agente-chatwoot-postgres-1 psql -U postgres -d chatwoot -t -A -c 'SELECT COUNT(*) FROM conversations;' 2>/dev/null | tr -d ' ')
MSG=$(docker exec agente-chatwoot-postgres-1 psql -U postgres -d chatwoot -t -A -c 'SELECT COUNT(*) FROM messages;' 2>/dev/null | tr -d ' ')
if [[ "${CONV:-0}" -gt 0 ]]; then
  ok "conversas no DB: ${CONV} (mensagens: ${MSG})"
else
  bad "nenhuma conversa no DB — rode ./phoenix e2e ou envie DM real"
fi

if [[ "$FAIL" -eq 0 ]]; then
  echo ""
  echo "Tudo certo. Admin: ${BASE}/comecar/paginas-business  |  ./phoenix paginas"
  exit 0
fi
echo ""
echo "Corrija os itens FAIL acima (ex.: docker compose up -d --force-recreate chatwoot-rails)"
exit 1
