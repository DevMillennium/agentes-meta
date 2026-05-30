#!/usr/bin/env bash
# Aplica branding Phoenix Digital Omnichannel no Chatwoot (DB + reinício).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[[ -f .env.chatwoot ]] && source .env.chatwoot

echo "==> Regenerar logos"
python3 scripts/phoenix-generate-branding.py

echo "==> InstallationConfig + inboxes"
docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  configs = {
    'INSTALLATION_NAME' => 'Phoenix Digital Omnichannel',
    'BRAND_NAME' => 'Phoenix Digital Omnichannel',
    'LOGO' => '/brand-assets/logo.png',
    'LOGO_DARK' => '/brand-assets/logo_dark.png',
    'LOGO_THUMBNAIL' => '/brand-assets/logo_thumbnail.png',
    'BRAND_URL' => 'https://phoenixglobal.com.br',
    'WIDGET_BRAND_URL' => 'https://phoenixglobal.com.br',
    'FB_APP_ID' => ENV.fetch('FB_APP_ID', '27447238071580159'),
    'FB_APP_SECRET' => ENV.fetch('FB_APP_SECRET', ''),
    'FB_VERIFY_TOKEN' => ENV.fetch('FB_VERIFY_TOKEN', 'phoenix-verify-token'),
    'IG_VERIFY_TOKEN' => ENV.fetch('IG_VERIFY_TOKEN', 'phoenix-verify-token'),
    'INSTAGRAM_VERIFY_TOKEN' => ENV.fetch('INSTAGRAM_VERIFY_TOKEN', 'phoenix-verify-token'),
    'FACEBOOK_API_VERSION' => 'v25.0',
    'INSTAGRAM_API_VERSION' => 'v25.0',
    'ENABLE_ACCOUNT_SIGNUP' => 'true',
    'CREATE_NEW_ACCOUNT_FROM_DASHBOARD' => 'true'
  }
  configs.each do |name, value|
    ic = InstallationConfig.find_or_initialize_by(name: name)
    ic.value = value
    ic.locked = false
    ic.save!
  end
  GlobalConfig.clear_cache

  # Inbox real Meta (Messenger + Instagram via página)
  real = Inbox.find_by(channel_type: 'Channel::FacebookPage')
  real&.update!(name: 'Phoenix Omnichannel — Messenger & Instagram')

  # Remover placeholders API (stack antiga / simulados)
  Inbox.where(channel_type: 'Channel::Api').find_each do |inbox|
    inbox.conversations.find_each(&:destroy!)
    inbox.destroy!
  end

  puts 'Branding Phoenix aplicado.'
" 2>&1 | tail -3

echo "==> Reiniciar Rails (template + CSS)"
docker compose -f docker-compose.chatwoot.yml up -d --force-recreate chatwoot-rails 2>&1 | tail -5

sleep 8
curl -sS http://localhost:3001/health && echo ""
echo "Painel: ${PHOENIX_OMNICHANNEL_URL:-http://localhost:3001}/app"
