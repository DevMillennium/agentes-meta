#!/usr/bin/env bash
# Cria projeto Neon, aplica schema Prisma e define DATABASE_URL na Vercel.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT_NAME="${NEON_PROJECT_NAME:-phoenix-marketing-ai}"
VERCEL_API_DIR="$ROOT"

echo "== Neon + Vercel DATABASE_URL =="

if ! command -v vercel >/dev/null 2>&1; then
  echo "Instale: npm i -g vercel"
  exit 1
fi

echo "[1/5] Autenticação Neon (abra o navegador e autorize)…"
open "https://console.neon.tech/" 2>/dev/null || true
npx neonctl@latest auth 2>&1 || true

if ! npx neonctl@latest projects list 2>/dev/null | grep -q .; then
  echo "⚠ Neon não autenticado. Conclua login em console.neon.tech e rode novamente."
  exit 1
fi

echo "[2/5] Criando projeto Neon (se não existir)…"
if ! npx neonctl@latest projects list --output json 2>/dev/null | python3 -c "
import json,sys
name='$PROJECT_NAME'
projects=json.load(sys.stdin).get('projects',[])
sys.exit(0 if any(p.get('name')==name for p in projects) else 1)
" 2>/dev/null; then
  npx neonctl@latest projects create --name "$PROJECT_NAME" --region aws-us-east-1
fi

echo "[3/5] Obtendo connection string…"
DATABASE_URL="$(npx neonctl@latest connection-string "$PROJECT_NAME" --database-name neondb --pooled 2>/dev/null | tail -1)"
if [[ -z "$DATABASE_URL" || "$DATABASE_URL" != postgresql://* ]]; then
  DATABASE_URL="$(npx neonctl@latest connection-string "$PROJECT_NAME" 2>/dev/null | tail -1)"
fi
if [[ -z "$DATABASE_URL" || "$DATABASE_URL" != postgresql://* ]]; then
  echo "Não foi possível obter DATABASE_URL do Neon."
  exit 1
fi
echo "✓ Connection string obtida"

echo "[4/5] Prisma db push no Neon…"
export DATABASE_URL
npx prisma db push

echo "[5/5] Enviando DATABASE_URL para Vercel (production)…"
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL production --force --yes
cd "$VERCEL_API_DIR"
vercel --prod --yes 2>&1 | tail -5

echo "✓ DATABASE_URL configurado na Vercel e deploy iniciado."
