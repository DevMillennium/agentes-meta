#!/usr/bin/env bash
# Abre no browser as telas de OAuth/conexão de canais no Chatwoot.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "$ROOT/.env.chatwoot" ]] && source "$ROOT/.env.chatwoot"
[[ -f "$ROOT/.env" ]] && source "$ROOT/.env"

BASE="${PHOENIX_OMNICHANNEL_URL:-http://localhost:3001}"
BASE="${BASE%/}"
ACCOUNT_ID="${CHATWOOT_ACCOUNT_ID:-1}"

LIST="${BASE}/app/accounts/${ACCOUNT_ID}/settings/inboxes/list"
NEW="${BASE}/app/accounts/${ACCOUNT_ID}/settings/inboxes/new"
FB="${BASE}/app/accounts/${ACCOUNT_ID}/settings/inboxes/new/facebook"
IG="${BASE}/app/accounts/${ACCOUNT_ID}/settings/inboxes/new/instagram"
WA="${BASE}/app/accounts/${ACCOUNT_ID}/settings/inboxes/new/whatsapp"

INBOX_ID=$(docker compose -f "$ROOT/docker-compose.chatwoot.yml" exec -T chatwoot-rails bundle exec rails runner \
  'puts Inbox.find_by(channel_type: "Channel::FacebookPage")&.id' 2>/dev/null | tail -1 || true)
EXISTING=""
if [[ -n "${INBOX_ID}" && "${INBOX_ID}" != "nil" ]]; then
  EXISTING="${BASE}/app/accounts/${ACCOUNT_ID}/settings/inboxes/${INBOX_ID}"
fi

cat <<EOF
Phoenix — conectar canais (OAuth no Chatwoot)

  Configurações → Caixas de Entrada → Adicionar

  Facebook/Messenger: ${FB}
  Instagram:          ${IG}
  WhatsApp:           ${WA}
  Lista:              ${LIST}
EOF
if [[ -n "$EXISTING" ]]; then
  echo "  Inbox Meta atual:   ${EXISTING}"
fi
echo ""
echo "Doc: docs/phoenix-conectar-canais.md"
echo ""

TARGET="${1:-new}"
case "$TARGET" in
  facebook|fb) open "$FB" 2>/dev/null || echo "$FB" ;;
  instagram|ig) open "$IG" 2>/dev/null || echo "$IG" ;;
  whatsapp|wa) open "$WA" 2>/dev/null || echo "$WA" ;;
  inbox|existing)
    if [[ -z "$EXISTING" ]]; then
      echo "Nenhum inbox FacebookPage. Abrindo lista."
      open "$LIST" 2>/dev/null || echo "$LIST"
    else
      open "$EXISTING" 2>/dev/null || echo "$EXISTING"
    fi
    ;;
  *) open "$NEW" 2>/dev/null || echo "$NEW" ;;
esac
