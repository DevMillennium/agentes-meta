#!/usr/bin/env bash
# Após OAuth local, envia META_ACCESS_TOKEN para Vercel (fallback serverless até Postgres cloud).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN=""
if [[ -f "$ROOT/.meta-token.local.json" ]]; then
  TOKEN="$(python3 -c "import json; print(json.load(open('$ROOT/.meta-token.local.json')).get('accessToken',''))" 2>/dev/null || true)"
fi
if [[ -z "$TOKEN" ]]; then
  TOKEN="$(npx tsx "$ROOT/scripts/meta-export-token.ts" 2>/dev/null || true)"
fi
if [[ -z "$TOKEN" ]]; then
  echo "Token Meta não encontrado (arquivo nem Postgres)."
  echo "1) Salve URIs no Meta Console: npm run meta:fix-oauth-redirect"
  echo "2) Conclua OAuth no Chrome: npm run meta:oauth:auto"
  echo "   (no Chrome: Continuar / Permitir na aba do Facebook)"
  exit 1
fi

cd "$ROOT"
printf '%s' "$TOKEN" | vercel env add META_ACCESS_TOKEN production --force --yes
echo "✓ META_ACCESS_TOKEN atualizado na Vercel. Redeploy: vercel --prod"
