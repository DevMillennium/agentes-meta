#!/usr/bin/env bash
# Automação completa Meta + Chatwoot (tokens Neon, inbox, webhooks, page subscribe)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a

APP_ID="${META_APP_ID:-27447238071580159}"
APP_SECRET="${META_APP_SECRET:?META_APP_SECRET ausente}"
VERIFY="${META_WEBHOOK_VERIFY_TOKEN:-phoenix-verify-token}"
API="${META_API_VERSION:-v25.0}"
APP_TOKEN="${APP_ID}|${APP_SECRET}"
PUBLIC="${PHOENIX_CHATWOOT_PUBLIC_URL:-https://adam-transmitted-glasgow-rent.trycloudflare.com}"
CW_URL="${CHATWOOT_BASE_URL:-http://localhost:3001}"
CW_TOKEN="${CHATWOOT_API_ACCESS_TOKEN:?CHATWOOT_API_ACCESS_TOKEN ausente}"
CW_ACCOUNT="${CHATWOOT_ACCOUNT_ID:-1}"
NEON_URL="${DATABASE_URL:-}"

if [[ -z "$NEON_URL" || "$NEON_URL" == *localhost* ]]; then
  NEON_URL="postgresql://neondb_owner:npg_YHckiwNCg64q@ep-jolly-lab-ap1i8kt4-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"
fi

echo "==> 1) Tokens Meta (Neon UserMetaConnection)"
USER_TOKEN=$(psql "$NEON_URL" -t -A -c 'SELECT "accessToken" FROM "UserMetaConnection" LIMIT 1;')
if [[ -z "$USER_TOKEN" ]]; then
  echo "ERRO: sem UserMetaConnection no Neon. Rode OAuth em phoenix-marketing-api primeiro."
  exit 1
fi

PAGES_JSON=$(curl -sS "https://graph.facebook.com/${API}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${USER_TOKEN}")
export PAGES_JSON USER_TOKEN
python3 << 'PY'
import json, os
pages = json.loads(os.environ["PAGES_JSON"])
if "error" in pages:
    raise SystemExit(pages["error"])
page = next((p for p in pages["data"] if p["id"] == "266953349832334"), pages["data"][0])
ig = (page.get("instagram_business_account") or {}).get("id", "")
out = {
    "user_access_token": os.environ["USER_TOKEN"],
    "page_access_token": page["access_token"],
    "page_id": page["id"],
    "page_name": page["name"],
    "instagram_id": ig,
}
open("/tmp/phoenix_meta_tokens.json", "w").write(json.dumps(out))
print(f"page={out['page_id']} ig={out['instagram_id']}")
PY

echo "==> 2) Chatwoot: registrar Facebook Page inbox"
python3 << PY
import json, urllib.request
t = json.load(open("/tmp/phoenix_meta_tokens.json"))
body = json.dumps({
    "user_access_token": t["user_access_token"],
    "page_access_token": t["page_access_token"],
    "page_id": t["page_id"],
    "inbox_name": t["page_name"],
}).encode()
req = urllib.request.Request(
    f"${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/callbacks/register_facebook_page",
    data=body,
    headers={"Content-Type": "application/json", "api_access_token": "${CW_TOKEN}"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as r:
        inbox = json.loads(r.read().decode())
        print("inbox_id", inbox.get("id"), inbox.get("channel_type"))
        open("/tmp/phoenix_cw_inbox.json", "w").write(json.dumps(inbox))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if "already" in body.lower() or "already been taken" in body.lower() or e.code in (422, 500):
        print("inbox já existe — buscando inbox FacebookPage")
        import urllib.parse
        req2 = urllib.request.Request(
            f"${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/inboxes",
            headers={"api_access_token": "${CW_TOKEN}"},
        )
        with urllib.request.urlopen(req2) as r2:
            inboxes = json.loads(r2.read().decode()).get("payload", [])
        inbox = next(i for i in inboxes if i.get("channel_type") == "Channel::FacebookPage")
        open("/tmp/phoenix_cw_inbox.json", "w").write(json.dumps(inbox))
        print("inbox_id", inbox.get("id"))
    else:
        print(body)
        raise
PY

INBOX_ID=$(python3 -c "import json; print(json.load(open('/tmp/phoenix_cw_inbox.json'))['id'])" 2>/dev/null || echo "4")

echo "==> 3) Chatwoot: agente no inbox ${INBOX_ID}"
curl -sS -X POST -H "api_access_token: ${CW_TOKEN}" -H "Content-Type: application/json" \
  "${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/inbox_members" \
  -d "{\"inbox_id\":${INBOX_ID},\"user_ids\":[1]}" >/dev/null || true

echo "==> 4) Meta: webhooks app-level"
subscribe_meta() {
  local object="$1"
  local fields="$2"
  local result
  result=$(curl -sS -X POST "https://graph.facebook.com/${API}/${APP_ID}/subscriptions" \
    -d "object=${object}" \
    -d "callback_url=${PUBLIC}/webhooks/meta" \
    -d "verify_token=${VERIFY}" \
    -d "fields=${fields}" \
    -d "access_token=${APP_TOKEN}")
  if echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)" 2>/dev/null; then
    echo "${object}: OK"
    return 0
  fi
  if echo "$result" | grep -q '1929002\|Permissions'; then
    echo "${object}: aviso de permissão (assinatura anterior pode já estar ativa) — ignorando"
    echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
    return 0
  fi
  echo "$result" | python3 -m json.tool
  return 1
}

subscribe_meta page "messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads,messaging_handovers,messaging_referrals,message_echoes,standby"
# Campos aceitos pelo objeto instagram no app (evitar message_reads/messaging_handover na re-inscrição)
subscribe_meta instagram "messages,messaging_postbacks,messaging_seen,messaging_referral,message_reactions"

echo "==> 5) Meta: domínios do app"
TUNNEL_HOST=$(python3 -c "from urllib.parse import urlparse; print(urlparse('${PUBLIC}').netloc)")
curl -sS -X POST "https://graph.facebook.com/${API}/${APP_ID}" \
  --data-urlencode "app_domains=[\"phoenix-marketing-api.vercel.app\",\"phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app\",\"localhost\",\"${TUNNEL_HOST}\"]" \
  -d "access_token=${APP_TOKEN}" | python3 -m json.tool

echo "==> 6) Meta: subscribed_apps na página (se permitido)"
PAGE_TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/phoenix_meta_tokens.json'))['page_access_token'])")
PAGE_ID=$(python3 -c "import json; print(json.load(open('/tmp/phoenix_meta_tokens.json'))['page_id'])")
curl -sS -X POST "https://graph.facebook.com/${API}/${PAGE_ID}/subscribed_apps" \
  -d "subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads" \
  -d "access_token=${PAGE_TOKEN}" | python3 -m json.tool || true

echo "==> 7) Chatwoot InstallationConfig (docker)"
docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner "
  %w[FB_APP_ID FB_APP_SECRET FB_VERIFY_TOKEN IG_VERIFY_TOKEN INSTAGRAM_VERIFY_TOKEN INSTAGRAM_APP_SECRET INSTAGRAM_APP_ID FACEBOOK_API_VERSION INSTAGRAM_API_VERSION].each do |name|
    val = ENV[name] || case name
      when 'FB_APP_ID' then '${APP_ID}'
      when 'INSTAGRAM_APP_ID' then ENV['INSTAGRAM_APP_ID'].presence || '${APP_ID}'
      when 'FB_APP_SECRET','INSTAGRAM_APP_SECRET' then '${APP_SECRET}'
      when 'FB_VERIFY_TOKEN','IG_VERIFY_TOKEN','INSTAGRAM_VERIFY_TOKEN' then '${VERIFY}'
      when 'FACEBOOK_API_VERSION','INSTAGRAM_API_VERSION' then '${API}'
    end
    ic = InstallationConfig.find_or_initialize_by(name: name)
    ic.value = val
    ic.locked = false
    ic.save!
  end
  GlobalConfig.clear_cache
  puts 'OK'
" 2>/dev/null | tail -1

echo "==> 8) Atualizar .env local (inbox Facebook)"
if grep -q '^CHATWOOT_INBOX_ID_FACEBOOK=' .env 2>/dev/null; then
  sed -i '' "s/^CHATWOOT_INBOX_ID_FACEBOOK=.*/CHATWOOT_INBOX_ID_FACEBOOK=${INBOX_ID}/" .env
else
  echo "CHATWOOT_INBOX_ID_FACEBOOK=${INBOX_ID}" >> .env
fi

echo "==> Concluído. Inbox Facebook id=${INBOX_ID} | Webhook ${PUBLIC}/webhooks/meta"
