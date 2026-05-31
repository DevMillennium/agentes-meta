#!/usr/bin/env bash
# Sincroniza FRONTEND_URL / PHOENIX_CHATWOOT_PUBLIC_URL entre .env.chatwoot e .env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[[ -f .env.chatwoot ]] && source .env.chatwoot
[[ -f .env ]] && source .env

TUNNEL_CANDIDATES=(
  "${PHOENIX_OMNICHANNEL_URL:-}"
  "${PHOENIX_CHATWOOT_PUBLIC_URL:-}"
  "https://adam-transmitted-glasgow-rent.trycloudflare.com"
)
PUBLIC=""
for cand in "${TUNNEL_CANDIDATES[@]}"; do
  [[ -z "$cand" ]] && continue
  cand="${cand%/}"
  if [[ "$cand" == http://localhost* ]]; then
    PUBLIC="${cand}"
    continue
  fi
  if curl -sS -m 4 -o /dev/null -w "%{http_code}" "${cand}/health" 2>/dev/null | grep -q 200; then
    PUBLIC="$cand"
    break
  fi
done
[[ -z "$PUBLIC" ]] && PUBLIC="http://localhost:3001"
PUBLIC="${PUBLIC%/}"
# Meta exige HTTPS no callback — preferir tunnel sobre localhost
if [[ "$PUBLIC" == http://localhost* ]]; then
  for cand in "https://adam-transmitted-glasgow-rent.trycloudflare.com"; do
    if curl -sS -m 4 -o /dev/null -w "%{http_code}" "${cand}/health" 2>/dev/null | grep -q 200; then
      PUBLIC="$cand"
      break
    fi
  done
fi

upsert_env() {
  local file="$1" key="$2" val="$3"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

for f in .env.chatwoot .env; do
  [[ -f "$f" ]] || continue
  upsert_env "$f" FRONTEND_URL "$PUBLIC"
  upsert_env "$f" PHOENIX_OMNICHANNEL_URL "$PUBLIC"
  upsert_env "$f" PHOENIX_CHATWOOT_PUBLIC_URL "$PUBLIC"
done

docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  ic = InstallationConfig.find_or_initialize_by(name: 'FRONTEND_URL')
  ic.value = '${PUBLIC}'
  ic.locked = false
  ic.save!
  GlobalConfig.clear_cache
  puts 'FRONTEND_URL DB OK'
" 2>/dev/null | tail -1

echo "URL pública sincronizada: ${PUBLIC}"
