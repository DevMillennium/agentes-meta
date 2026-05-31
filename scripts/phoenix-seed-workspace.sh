#!/usr/bin/env bash
# Popular workspace Phoenix: respostas prontas, labels e automação básica (Chatrace parity).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker compose -f docker-compose.chatwoot.yml"

echo "==> Seed: labels + respostas prontas + automação"
$COMPOSE exec -T chatwoot-rails bundle exec rails runner '
  account = Account.find(1)

  # 1) Labels (funil simples estilo Chatrace pipeline)
  labels = {
    "novo-lead"     => "1f93ff",
    "em-atendimento"=> "f5a623",
    "vendas"        => "7cd33d",
    "suporte"       => "9013fe",
    "resolvido"     => "4caf50"
  }
  labels.each do |title, color|
    l = account.labels.find_or_initialize_by(title: title)
    l.color = color
    l.show_on_sidebar = true
    l.save!
  end
  puts "labels=#{account.labels.count}"

  # 2) Respostas prontas (saved replies)
  canned = {
    "ola"        => "Olá! Sou a Fernanda, da Phoenix Imports. Como posso ajudar você hoje?",
    "horario"    => "Nosso atendimento funciona de segunda a sexta, das 9h às 18h (horário de Brasília).",
    "pedido"     => "Para consultar seu pedido, me informe o número do pedido, por favor.",
    "obrigado"   => "Obrigada pelo contato! Qualquer coisa, estamos à disposição. 💛",
    "humano"     => "Vou transferir você para um de nossos especialistas. Um momento, por favor.",
    "pagamento"  => "Aceitamos cartão, Pix e boleto. Posso te enviar o link de pagamento seguro?",
    "entrega"    => "O prazo de entrega depende da sua região. Me informe seu CEP que verifico para você."
  }
  canned.each do |code, content|
    cr = account.canned_responses.find_or_initialize_by(short_code: code)
    cr.content = content
    cr.save!
  end
  puts "canned=#{account.canned_responses.count}"

  # 3) Automação: marcar novos contatos como novo-lead
  rule = account.automation_rules.find_or_initialize_by(name: "Phoenix — etiquetar novo lead")
  rule.description = "Adiciona a etiqueta novo-lead em toda conversa criada."
  rule.event_name = "conversation_created"
  rule.active = true
  rule.conditions = [
    { "attribute_key" => "status", "filter_operator" => "equal_to", "values" => ["pending", "open"], "query_operator" => nil }
  ]
  rule.actions = [
    { "action_name" => "add_label", "action_params" => ["novo-lead"] }
  ]
  rule.save!
  puts "automation=#{account.automation_rules.count} active=#{rule.active}"
' 2>/dev/null | grep -E 'labels=|canned=|automation='

echo ""
echo "Seed concluído. Respostas prontas em Configurações → Respostas prontas; automação em Configurações → Automação."
