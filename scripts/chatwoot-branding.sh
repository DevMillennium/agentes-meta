#!/usr/bin/env bash
# Aplica nome + logo Phoenix Global Digital Automation no Chatwoot self-hosted.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRAND_NAME="Phoenix Digital Agents Omnichannel"
LOGO="/brand-assets/logo.png"
LOGO_DARK="/brand-assets/logo_dark.png"
THUMB="/brand-assets/logo_thumbnail.png"
CUSTOM_CSS='<link rel="stylesheet" href="/brand-assets/custom.css?v=login4">'

echo "==> Processando logo (fundo transparente + tamanho maior)..."
if [[ -n "${PHOENIX_LOGO_PATH:-}" && -f "${PHOENIX_LOGO_PATH}" ]]; then
  python3 scripts/process-chatwoot-logo.py "${PHOENIX_LOGO_PATH}"
else
  python3 scripts/process-chatwoot-logo.py 2>/dev/null || true
fi

echo "==> Garantindo assets em chatwoot-brand/"
mkdir -p chatwoot-brand
SRC="${PHOENIX_LOGO_PATH:-}"
if [[ -z "$SRC" ]]; then
  SRC=$(ls chatwoot-brand/logo.png 2>/dev/null || true)
fi
if [[ ! -f chatwoot-brand/logo.png ]]; then
  echo "Coloque o logo em chatwoot-brand/logo.png e rode de novo."
  exit 1
fi
cp -f chatwoot-brand/logo.png chatwoot-brand/logo_thumbnail.png 2>/dev/null || true

echo "==> Atualizando .env.chatwoot..."
if [[ -f .env.chatwoot ]]; then
  grep -q '^INSTALLATION_NAME=' .env.chatwoot && \
    sed -i.bak "s/^INSTALLATION_NAME=.*/INSTALLATION_NAME=${BRAND_NAME}/" .env.chatwoot || \
    echo "INSTALLATION_NAME=${BRAND_NAME}" >> .env.chatwoot
  grep -q '^BRAND_NAME=' .env.chatwoot && \
    sed -i.bak "s/^BRAND_NAME=.*/BRAND_NAME=${BRAND_NAME}/" .env.chatwoot || \
    echo "BRAND_NAME=${BRAND_NAME}" >> .env.chatwoot
  rm -f .env.chatwoot.bak
else
  cp .env.chatwoot.example .env.chatwoot
fi

echo "==> Reiniciando Chatwoot..."
docker start chatwoot-postgres chatwoot-redis chatwoot-rails chatwoot-sidekiq 2>/dev/null || true
npm run chatwoot:up 2>/dev/null || docker compose -p chatwoot -f docker-compose.chatwoot.yml up -d

echo "==> Aguardando Rails..."
for _ in $(seq 1 30); do
  curl -sfL -o /dev/null http://localhost:3001/ 2>/dev/null && break
  sleep 2
done

echo "==> Aplicando branding no banco (InstallationConfig + Account)..."
docker compose -p chatwoot -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner \
  "name='${BRAND_NAME}'; logo='${LOGO}'; logo_dark='${LOGO_DARK}'; thumb='${THUMB}'; css='${CUSTOM_CSS}';
   %w[INSTALLATION_NAME BRAND_NAME].each { |k| c=InstallationConfig.find_or_initialize_by(name: k); c.value=name; c.save! };
   c=InstallationConfig.find_or_initialize_by(name: 'LOGO'); c.value=logo; c.save!;
   c=InstallationConfig.find_or_initialize_by(name: 'LOGO_DARK'); c.value=logo; c.save!;
   c=InstallationConfig.find_or_initialize_by(name: 'LOGO_THUMBNAIL'); c.value=thumb; c.save!;
   c=InstallationConfig.find_or_initialize_by(name: 'DASHBOARD_SCRIPTS'); c.value=css; c.save!;
   GlobalConfig.clear_cache;
   Account.find_each { |a| a.update!(name: name) if a.name.to_s.include?('Phoenix') || a.name == 'Acme Inc' || a.name == 'Phoenix Global' }" \
  2>/dev/null || true

echo ""
echo "✅ Branding aplicado: ${BRAND_NAME}"
echo "   Abra: npm run chatwoot:open"
echo "   Logo: http://localhost:3001/brand-assets/logo.png"
