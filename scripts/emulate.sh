#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Criado .env a partir de .env.example — ajuste OPENAI_API_KEY e credenciais se necessário."
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h localhost -p 5432 >/dev/null 2>&1 || brew services start postgresql@16 2>/dev/null || true
fi

npm install
npm run prisma:generate
npm run prisma:push
npm run build --workspace @phoenix/api

lsof -ti :"${PORT:-4000}" | xargs kill -9 2>/dev/null || true

npm run start --workspace @phoenix/api &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT:-4000}/health" >/dev/null; then
    break
  fi
  sleep 0.3
done

URL="http://localhost:${PORT:-4000}/dev/emulator"
echo "Emulador: $URL"
open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true

wait "$API_PID"
