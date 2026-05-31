#!/usr/bin/env bash
# Configura Captain (OpenAI) + assistente Fernanda + liga à inbox Meta.
# Usa a mesma API key da integração OpenAI em Configurações → Integrações (se existir).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[[ -f .env.chatwoot ]] && source .env.chatwoot
[[ -f .env ]] && source .env

COMPOSE="docker compose -f docker-compose.chatwoot.yml"
ASSISTANT_NAME="${PHOENIX_CAPTAIN_NAME:-Fernanda}"
ACCOUNT_ID="${CHATWOOT_ACCOUNT_ID:-1}"
MODEL="${OPENAI_MODEL:-${CAPTAIN_OPEN_AI_MODEL:-gpt-4o-mini}}"

echo "==> Phoenix Captain — assistente ${ASSISTANT_NAME}"

$COMPOSE exec -T \
  -e PHOENIX_CAPTAIN_NAME="$ASSISTANT_NAME" \
  -e PHOENIX_OPENAI_MODEL="$MODEL" \
  -e PHOENIX_ACCOUNT_ID="$ACCOUNT_ID" \
  chatwoot-rails bundle exec rails runner "
  require 'agents'

  assistant_label = ENV.fetch('PHOENIX_CAPTAIN_NAME', 'Fernanda')
  model = ENV.fetch('PHOENIX_OPENAI_MODEL', 'gpt-4o-mini')
  account = Account.find(ENV.fetch('PHOENIX_ACCOUNT_ID', '1').to_i)
  hook = Integrations::Hook.find_by(account_id: account.id, app_id: 'openai')
  api_key = ENV['OPENAI_API_KEY'].presence ||
            ENV['CAPTAIN_OPEN_AI_API_KEY'].presence ||
            hook&.settings&.dig('api_key')

  if api_key.blank?
    puts 'ERRO: sem API key OpenAI. Configure em Configurações → Integrações → OpenAI ou OPENAI_API_KEY em .env'
    exit 1
  end

  %w[CAPTAIN_OPEN_AI_API_KEY CAPTAIN_OPEN_AI_MODEL].each do |name|
    ic = InstallationConfig.find_or_initialize_by(name: name)
    ic.value = (name == 'CAPTAIN_OPEN_AI_API_KEY' ? api_key : model)
    ic.locked = false
    ic.save!
  end
  GlobalConfig.clear_cache

  Agents.configure do |config|
    config.openai_api_key = api_key
    config.default_model = model
    config.debug = false
  end

  inbox = Inbox.where(account_id: account.id, channel_type: 'Channel::FacebookPage').first
  unless inbox
    puts 'ERRO: nenhuma inbox Channel::FacebookPage. Conecte Messenger primeiro (./phoenix connect facebook).'
    exit 1
  end

  description = <<~DESC.strip
    Seu nome é #{assistant_label}. Você é a Diretora de Atendimento ao Cliente da Phoenix Imports.
    Atenda com cordialidade, clareza e foco em resolver dúvidas sobre produtos, pedidos e suporte.
    Quando não souber ou o cliente pedir humano, faça handoff para a equipe.
  DESC

  assistant = Captain::Assistant.find_or_initialize_by(account_id: account.id, name: assistant_label)
  assistant.description = description
  assistant.config = {
    'product_name' => 'Phoenix Imports',
    'temperature' => 0.6,
    'feature_faq' => true,
    'feature_memory' => true,
    'feature_citation' => false,
    'feature_contact_attributes' => true,
    'welcome_message' => 'Olá! Sou a Fernanda, diretora de atendimento da Phoenix Imports. Como posso ajudar você hoje?',
    'handoff_message' => 'Vou encaminhar você para um especialista da nossa equipe. Um momento, por favor.',
    'resolution_message' => 'Fico feliz em ter ajudado! Se precisar de mais alguma coisa, estamos à disposição.',
    'instructions' => <<~INST.strip
      Você representa a Phoenix Imports no omnichannel (Messenger e Instagram).
      Responda em português do Brasil, de forma profissional e objetiva.
      Não invente preços, prazos ou status de pedido — peça dados ou transfira para humano.
      Para reclamações graves ou pedidos de cancelamento, faça handoff imediato.
    INST
  }
  assistant.response_guidelines = [
    'Seja empática e use frases curtas.',
    'Confirme o entendimento antes de responder pedidos complexos.',
    'Nunca compartilhe dados internos ou de outros clientes.'
  ]
  assistant.guardrails = [
    'Não forneça aconselhamento jurídico ou médico.',
    'Não aceite pagamentos nem peça dados de cartão no chat.',
    'Se o cliente estiver agressivo, mantenha a calma e ofereça handoff.'
  ]
  assistant.save!

  CaptainInbox.find_or_create_by!(captain_assistant: assistant, inbox: inbox)

  # Também atender no widget do site (omnichannel): liga e desativa coleta de e-mail pré-chat
  widget = account.inboxes.where(channel_type: 'Channel::WebWidget').first
  if widget
    CaptainInbox.find_or_create_by!(captain_assistant: assistant, inbox: widget)
    widget.channel.update!(pre_chat_form_enabled: false) if widget.channel.respond_to?(:pre_chat_form_enabled)
    puts \"OK Widget ##{widget.id} «#{widget.name}» ligado ao Captain\"
  end

  puts \"OK Captain: assistente ##{assistant.id} «#{assistant.name}»\"
  puts \"OK Inbox ##{inbox.id} «#{inbox.name}» — novas conversas entram como pending (bot ativo)\"
  puts \"OK Modelo: #{model}\"
  puts \"Painel: #{ENV.fetch('FRONTEND_URL', 'http://localhost:3001')}/app/accounts/#{account.id}/captain/#{assistant.id}/playground\"
  puts \"Ajustes: .../captain/#{assistant.id}/settings\"
" 2>&1 | tail -12

echo "==> Reiniciar Rails (recarregar CAPTAIN_OPEN_AI_API_KEY no boot)"
$COMPOSE up -d --force-recreate chatwoot-rails 2>&1 | tail -3
sleep 6
curl -sS -o /dev/null -w "health: %{http_code}\n" http://localhost:3001/health

echo ""
echo "Pronto. Não use «Criar Robô» com webhook vazio — o Captain já responde nesta inbox."
echo "Teste: envie mensagem no Messenger/Instagram ou use o Playground no link acima."
