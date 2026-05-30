#!/usr/bin/env bash
# Habilita cadastro público (teste grátis) no Chatwoot.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  %w[ENABLE_ACCOUNT_SIGNUP CREATE_NEW_ACCOUNT_FROM_DASHBOARD].each do |name|
    ic = InstallationConfig.find_or_initialize_by(name: name)
    ic.value = 'true'
    ic.locked = false
    ic.save!
  end
  GlobalConfig.clear_cache
  puts 'Signup público habilitado.'
" 2>&1 | tail -3

echo "Landing: ${PHOENIX_OMNICHANNEL_URL:-http://localhost:3001}/"
echo "Canais:  ${PHOENIX_OMNICHANNEL_URL:-http://localhost:3001}/comecar/canais"
