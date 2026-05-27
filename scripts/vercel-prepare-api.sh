#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npx prisma generate
npm run build --workspace @phoenix/api

rm -rf api/phoenix-dist
cp -r apps/api/dist api/phoenix-dist

echo "API pronta para Vercel: api/phoenix-dist ($(find api/phoenix-dist -name '*.js' | wc -l | tr -d ' ') ficheiros JS)"
