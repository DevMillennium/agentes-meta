#!/usr/bin/env bash
# Sincroniza .env para Vercel (production) com URLs de nuvem; mantém segredos do .env local.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

CLOUD_API="${PHOENIX_CLOUD_API_URL:-https://phoenix-marketing-api.vercel.app}"
CLOUD_WEB="${PHOENIX_CLOUD_WEB_URL:-https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo $ENV_FILE não encontrado."
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Instale a CLI: npm i -g vercel"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

export API_PUBLIC_URL="$CLOUD_API"
export WEB_APP_URL="$CLOUD_WEB"
export API_CORS_ORIGIN="$CLOUD_WEB"
export META_REDIRECT_URI="${CLOUD_API%/}/api/meta/oauth/callback"
export NEXT_PUBLIC_API_URL="$CLOUD_API"
export NEXT_PUBLIC_META_APP_ID="${META_APP_ID:-27447238071580159}"
export NEXT_PUBLIC_META_API_VERSION="${META_API_VERSION:-v25.0}"

echo "== Sync Vercel (cloud) =="
echo "API: $API_PUBLIC_URL"
echo "WEB: $WEB_APP_URL"
echo "META_REDIRECT_URI: $META_REDIRECT_URI"
echo ""

sync_project() {
  local target="$1"
  local dir="$2"
  cd "$dir"
  echo "--- Projeto $target ($dir) ---"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    [[ -z "$key" || -z "$value" ]] && continue

    if [[ "$key" == "DATABASE_URL" && "$value" == *localhost* ]]; then
      echo "  ⊘ $key (ignorado: localhost — defina Postgres na nuvem no painel Vercel)"
      continue
    fi
    if [[ "$key" == "REDIS_URL" && "$value" == *localhost* ]]; then
      echo "  ⊘ $key (ignorado: localhost)"
      continue
    fi

    if [[ "$target" == "web" ]]; then
      [[ "$key" == NEXT_PUBLIC_* ]] || continue
    else
      [[ "$key" == NEXT_PUBLIC_* ]] && continue
    fi

    # Overrides cloud
    case "$key" in
      API_PUBLIC_URL) value="$API_PUBLIC_URL" ;;
      WEB_APP_URL) value="$WEB_APP_URL" ;;
      API_CORS_ORIGIN) value="$API_CORS_ORIGIN" ;;
      META_REDIRECT_URI) value="$META_REDIRECT_URI" ;;
      NEXT_PUBLIC_API_URL) value="$NEXT_PUBLIC_API_URL" ;;
      NEXT_PUBLIC_META_APP_ID) value="$NEXT_PUBLIC_META_APP_ID" ;;
      NEXT_PUBLIC_META_API_VERSION) value="$NEXT_PUBLIC_META_API_VERSION" ;;
    esac

    printf '%s' "$value" | vercel env add "$key" production --force --yes 2>/dev/null || true
    echo "  ✓ $key"
  done < "$ENV_FILE"
}

sync_project api "$ROOT"
sync_project web "$ROOT/apps/web"

echo ""
echo "Concluído. Rode um redeploy na Vercel se necessário."
