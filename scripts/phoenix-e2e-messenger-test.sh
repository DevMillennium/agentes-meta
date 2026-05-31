#!/usr/bin/env bash
# Teste E2E local: simula DM Messenger → conversa pending → Captain responde
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Simular mensagem Messenger (FacebookEventsJob)"
docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  page = Channel::FacebookPage.first
  abort 'sem FacebookPage' unless page
  psid = 'phoenix_test_' + SecureRandom.hex(6)
  mid = 'mid.phoenix.' + SecureRandom.hex(12)
  payload = {
    messaging: {
      sender: { id: psid },
      recipient: { id: page.page_id },
      timestamp: (Time.now.to_f * 1000).to_i,
      message: { mid: mid, text: 'Olá Fernanda, teste automatizado Phoenix omnichannel.' }
    }
  }.to_json
  Webhooks::FacebookEventsJob.perform_now(payload)
  conv = Conversation.where(inbox_id: page.inbox.id).order(id: :desc).first
  puts \"CONV_ID=#{conv&.id} STATUS=#{conv&.status} MSGS=#{conv&.messages&.count}\"
" 2>&1 | tail -5

echo "==> Processar fila Sidekiq (Captain ResponseBuilderJob)"
sleep 2
docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-sidekiq bundle exec rails runner "
  require 'sidekiq/api'
  q = Sidekiq::Queue.new('default')
  puts \"queue_size=#{q.size}\"
" 2>/dev/null | tail -1 || true

sleep 8

echo "==> Resultado"
docker exec agente-chatwoot-postgres-1 psql -U postgres -d chatwoot -t -c \
  "SELECT c.id, c.status, COUNT(m.id) FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id GROUP BY c.id, c.status ORDER BY c.id DESC LIMIT 3;"

docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  conv = Conversation.order(id: :desc).first
  if conv.nil?
    puts 'SEM_CONVERSA'
  else
    conv.messages.order(:id).each do |m|
      who = m.sender_type || 'system'
      puts \"  [#{m.message_type}] #{who}: #{m.content.to_s.truncate(80)}\"
    end
  end
" 2>&1 | grep -E '^\s+\[|CONV_ID|SEM_' || true
