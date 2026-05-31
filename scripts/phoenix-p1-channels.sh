#!/usr/bin/env bash
# P1 Chatrace parity: WhatsApp + Instagram App ID + widget embed
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[[ -f .env.chatwoot ]] && source .env.chatwoot
[[ -f .env ]] && source .env

COMPOSE="docker compose -f docker-compose.chatwoot.yml"
PUBLIC="${PHOENIX_OMNICHANNEL_URL:-${FRONTEND_URL:-http://localhost:3001}}"
PUBLIC="${PUBLIC%/}"

echo "==> P1.1 Instagram App ID (InstallationConfig)"
FB_ID="${FB_APP_ID:-27447238071580159}"
IG_ID="${INSTAGRAM_APP_ID:-}"

$COMPOSE exec -T \
  -e INSTAGRAM_APP_ID="${INSTAGRAM_APP_ID:-}" \
  -e INSTAGRAM_APP_SECRET="${INSTAGRAM_APP_SECRET:-${META_APP_SECRET:-}}" \
  chatwoot-rails bundle exec rails runner "
  fb = '${FB_ID}'
  ig = ENV['INSTAGRAM_APP_ID'].presence || '${IG_ID}'
  ig = ig.presence || fb
  %w[INSTAGRAM_APP_ID INSTAGRAM_APP_SECRET].each do |name|
    ic = InstallationConfig.find_or_initialize_by(name: name)
    ic.value = (name == 'INSTAGRAM_APP_ID' ? ig : ENV.fetch('INSTAGRAM_APP_SECRET', ENV.fetch('META_APP_SECRET', '')))
    ic.locked = false
    ic.save!
  end
  GlobalConfig.clear_cache
  if ig == fb
    puts 'AVISO: INSTAGRAM_APP_ID igual ao FB_APP_ID — crie produto Instagram Login no Meta e defina INSTAGRAM_APP_ID no .env'
  else
    puts 'OK INSTAGRAM_APP_ID distinto do Facebook'
  end
  puts \"IG_APP_ID=#{ig}\"
" 2>/dev/null | tail -3

echo "==> P1.2 Widget web — snippet em brand-assets"
$COMPOSE exec -T chatwoot-rails bundle exec rails runner "
  account = Account.find(1)
  channel = Channel::WebWidget.joins(:inbox).where(inboxes: { account_id: account.id }).first
  unless channel
    channel = Channel::WebWidget.create!(account: account, website_url: 'https://phoenixglobal.com.br')
    Inbox.create!(account: account, name: 'Chat Phoenix — Website', channel: channel)
  end
  base = ENV.fetch('FRONTEND_URL', 'http://localhost:3001').to_s.chomp('/')
  token = channel.website_token
  snippet = <<~HTML
  <!-- Phoenix Digital Omnichannel — Widget -->
  <script>
    window.chatwootSettings = { locale: 'pt_BR', position: 'right' };
    (function(d,t) {
      var BASE_URL='#{base}';
      var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
      g.src=BASE_URL+'/packs/js/sdk.js';
      g.defer=true;
      g.async=true;
      s.parentNode.insertBefore(g,s);
      g.onload=function(){
        window.chatwootSDK.run({ websiteToken: '#{token}', baseUrl: BASE_URL });
      };
    })(document,'script');
  </script>
  HTML
  path = Rails.root.join('public/brand-assets/phoenix-widget-snippet.html')
  File.write(path, snippet)
  puts \"WIDGET_INBOX=#{channel.inbox.id} TOKEN=#{token}\"
  puts \"SNIPPET=#{path}\"
" 2>/dev/null | tail -4

# Copiar snippet para host (volume só monta ro de brand-assets parcial)
docker cp agente-chatwoot-rails-1:/app/public/brand-assets/phoenix-widget-snippet.html \
  "$ROOT/chatwoot/public/brand-assets/phoenix-widget-snippet.html" 2>/dev/null || true

echo "==> P1.3 Atualizar .env.chatwoot.example"
if ! grep -q '^INSTAGRAM_APP_ID=' "$ROOT/.env.chatwoot.example" 2>/dev/null; then
  cat >>"$ROOT/.env.chatwoot.example" <<'EOF'

# P1 — Instagram Login (ID do produto Instagram no Meta Developer, NÃO reutilize só FB_APP_ID)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# P1 — WhatsApp Cloud (opcional)
WHATSAPP_APP_ID=
WHATSAPP_CONFIGURATION_ID=
EOF
fi

echo ""
echo "P1 concluído."
echo "  Widget:  ${PUBLIC}/comecar/widget"
echo "  WhatsApp: ./phoenix connect whatsapp"
echo "  Instagram ID manual: Meta Developer → Instagram → copiar App ID → INSTAGRAM_APP_ID no .env → ./phoenix p1"
