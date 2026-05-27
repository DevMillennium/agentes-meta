#!/usr/bin/env bash
# Sincroniza variáveis do .env na raiz para um projeto Vercel (production).
# Uso: ./scripts/vercel-sync-env.sh api|web
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
TARGET="${1:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo $ENV_FILE não encontrado."
  exit 1
fi

case "$TARGET" in
  api) DIR="$ROOT/apps/api" ;;
  web) DIR="$ROOT/apps/web" ;;
  *)
    echo "Uso: $0 api|web"
    exit 1
    ;;
esac

cd "$DIR"

echo "Sincronizando env para $(pwd) (production)..."

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  [[ -z "$key" ]] && continue
  [[ -z "$value" ]] && continue

  if [[ "$TARGET" == "web" ]]; then
    [[ "$key" == NEXT_PUBLIC_* ]] || continue
  else
    [[ "$key" == NEXT_PUBLIC_* ]] && continue
  fi

  printf '%s' "$value" | vercel env add "$key" production --force --yes 2>/dev/null || true
  echo "  ✓ $key"
done < "$ENV_FILE"

echo "Concluído. Confira: vercel env ls"
