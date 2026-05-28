#!/usr/bin/env bash
# Configura Meta + Phoenix em NUVEM (Vercel) e abre Chrome; mantém .env local intacto.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PHOENIX_TARGET=cloud
export PHOENIX_CLOUD_API_URL="${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}"
export PHOENIX_CLOUD_WEB_URL="${PHOENIX_CLOUD_WEB_URL:-https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app}"

echo "== Phoenix Meta — setup nuvem + Chrome =="

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "[1/4] Sincronizando variáveis na Vercel (URLs cloud)…"
if command -v vercel >/dev/null 2>&1; then
  bash scripts/vercel-sync-cloud-env.sh || echo "⚠ Sync Vercel falhou — confira login: vercel login"
else
  echo "⚠ vercel CLI ausente — pule ou instale: npm i -g vercel"
fi

echo "[2/4] Abrindo Meta Console e copiando URIs (local + cloud)…"
bash scripts/meta-fix-oauth-redirect.sh

echo "[3/4] OAuth automático na API de nuvem (Chrome autenticado)…"
export API_PUBLIC_URL="$PHOENIX_CLOUD_API_URL"
export WEB_APP_URL="$PHOENIX_CLOUD_WEB_URL"
npm run meta:oauth:auto

echo "[4/4] Bootstrap Meta em produção…"
API_KEY="${ADMIN_API_KEY:-}" API_BASE_URL="$PHOENIX_CLOUD_API_URL" npm run meta:bootstrap:prod || true

echo ""
echo "✓ Setup cloud concluído. Local continua em http://localhost:4000 / :3000"
