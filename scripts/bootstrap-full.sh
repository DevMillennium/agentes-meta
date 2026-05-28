#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Instalando dependências..."
npm install

echo "==> Prisma generate + push..."
npm run prisma:generate
npm run prisma:push

echo "==> Build API..."
npm run build --workspace @phoenix/api

echo "==> Seed produtos (requer API rodando)..."
npm run start --workspace @phoenix/api &
API_PID=$!
sleep 3

API_KEY="${ADMIN_API_KEY:-phoenix-local-api-key-16}"
curl -sf -X POST "http://localhost:4000/api/products/seed/default" \
  -H "x-api-key: ${API_KEY}" \
  -H "content-type: application/json" || echo "Seed: inicie a API manualmente e POST /api/products/seed/default"

kill "$API_PID" 2>/dev/null || true

echo "==> Concluído. Próximos passos:"
echo "  1. npm run start --workspace @phoenix/api"
echo "  2. npm run dev --workspace @phoenix/web"
echo "  3. http://localhost:4000/api/meta/oauth/login"
echo "  4. http://localhost:3000/configuracoes/meta"
