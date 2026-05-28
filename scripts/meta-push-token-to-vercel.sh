#!/usr/bin/env bash
# Após OAuth local, envia META_ACCESS_TOKEN para Vercel (fallback serverless até Postgres cloud).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="$ROOT/.meta-token.local.json"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Token não encontrado. Rode primeiro: npm run meta:oauth:auto"
  exit 1
fi

TOKEN="$(python3 -c "import json; print(json.load(open('$TOKEN_FILE'))['accessToken'])")"
if [[ -z "$TOKEN" ]]; then
  echo "accessToken vazio em $TOKEN_FILE"
  exit 1
fi

cd "$ROOT"
printf '%s' "$TOKEN" | vercel env add META_ACCESS_TOKEN production --force --yes
echo "✓ META_ACCESS_TOKEN atualizado na Vercel. Redeploy: vercel --prod"
