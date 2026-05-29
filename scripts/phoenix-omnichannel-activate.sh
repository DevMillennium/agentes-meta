#!/usr/bin/env bash
# Torna o painel operacional: remove inboxes API legados, consolida Meta, valida webhooks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
[[ -f .env.chatwoot ]] && source .env.chatwoot

echo "==> 1) Limpar inboxes legados (Channel::Api)"
docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner '
  account = Account.find(1)
  account.update!(name: "Phoenix Digital Omnichannel") if account.name != "Phoenix Digital Omnichannel"

  real = account.inboxes.find_by(channel_type: "Channel::FacebookPage")
  unless real
    puts "ERRO: inbox FacebookPage não encontrado. Rode: ./phoenix meta"
    exit 1
  end
  real.update!(name: "Phoenix Omnichannel — Messenger & Instagram")
  real.add_members([1]) unless real.inbox_members.exists?(user_id: 1)

  removed = []
  account.inboxes.where(channel_type: "Channel::Api").find_each do |inbox|
    conv_count = inbox.conversations.count
    inbox.conversations.find_each(&:destroy!)
    removed << "#{inbox.id} (#{conv_count} conv.)"
    inbox.destroy!
  end
  puts "Inbox ativo: id=#{real.id} page=#{real.channel.page_id} ig=#{real.channel.instagram_id}"
  puts "Removidos: #{removed.empty? ? "nenhum" : removed.join(", ")}"
' 2>&1 | tail -10

echo "==> 2) Sincronizar .env (inbox único Meta)"
REAL_ID=$(docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner 'puts Inbox.find_by(channel_type: "Channel::FacebookPage")&.id' 2>/dev/null | tail -1)
for key in CHATWOOT_INBOX_ID_FACEBOOK CHATWOOT_INBOX_ID_INSTAGRAM CHATWOOT_INBOX_ID_WHATSAPP; do
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i '' "s/^${key}=.*/${key}=${REAL_ID}/" .env
  else
    echo "${key}=${REAL_ID}" >> .env
  fi
done
echo "CHATWOOT_INBOX_ID → ${REAL_ID}"

echo "==> 3) Meta + webhooks"
"$ROOT/scripts/phoenix-meta-full-auto.sh" 2>&1 | tail -15

echo "==> 4) Health"
curl -sS http://localhost:3001/health && echo ""
PUBLIC="${PHOENIX_OMNICHANNEL_URL:-http://localhost:3001}"
echo "Webhook: ${PUBLIC}/webhooks/meta"
echo "Painel: ${PUBLIC}/app"
echo ""
echo "Operação: use apenas o inbox «Phoenix Omnichannel — Messenger & Instagram»."
echo "Envie DM de teste no Messenger ou Instagram da página Phoenix Global Import."
