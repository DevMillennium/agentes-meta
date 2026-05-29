#!/usr/bin/env bash
# Mantém tunnel HTTPS público para webhooks Meta → Chatwoot local :3001
set -euo pipefail
if ! command -v cloudflared >/dev/null; then
  echo "Instale: brew install cloudflared"
  exit 1
fi
echo "Iniciando tunnel para http://localhost:3001 ..."
cloudflared tunnel --url http://localhost:3001 2>&1 | tee /tmp/phoenix-cloudflared.log &
sleep 6
URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare.com' /tmp/phoenix-cloudflared.log | head -1)
if [[ -n "$URL" ]]; then
  echo "PHOENIX_CHATWOOT_PUBLIC_URL=$URL"
  export PHOENIX_CHATWOOT_PUBLIC_URL="$URL"
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  if [[ -f "$ROOT/.env.chatwoot" ]]; then
    sed -i '' "s|^FRONTEND_URL=.*|FRONTEND_URL=${URL}|" "$ROOT/.env.chatwoot" 2>/dev/null || \
      sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${URL}|" "$ROOT/.env.chatwoot"
  fi
  "$ROOT/scripts/phoenix-meta-full-auto.sh"
else
  echo "Não foi possível obter URL do tunnel. Veja /tmp/phoenix-cloudflared.log"
fi
