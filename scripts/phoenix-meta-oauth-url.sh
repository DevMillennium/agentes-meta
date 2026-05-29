#!/usr/bin/env bash
# Gera URL OAuth Meta válida (state JWT assinado pela API Phoenix).
# O state "phoenix-auto-..." causa: "Código ou state OAuth inválido/expirado."
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "$ROOT/.env" ]] && source "$ROOT/.env"

# Produção Vercel (API local pode estar indisponível)
API="${PHOENIX_OAUTH_API_URL:-https://phoenix-marketing-api.vercel.app}"
EMAIL="${ADMIN_EMAIL:-admin@phoenixglobal.com.br}"
PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD ausente no .env}"
EXTRA_SCOPE="${META_OAUTH_EXTRA_SCOPES:-pages_messaging}"

echo "==> Login Phoenix API ($API)"
LOGIN_JSON=$(curl -sS -X POST "${API}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

ACCESS_TOKEN=$(echo "$LOGIN_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null || true)

URL=""
if [[ -n "$ACCESS_TOKEN" ]]; then
  echo "==> URL OAuth assinada (/api/meta/oauth/login-url)"
  OAUTH_JSON=$(curl -sS -H "Authorization: Bearer ${ACCESS_TOKEN}" "${API}/api/meta/oauth/login-url")
  URL=$(echo "$OAUTH_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || true)
fi

if [[ -z "$URL" ]]; then
  echo "==> Fallback: gerar state JWT local (mesmo JWT_SECRET da Vercel)"
  URL=$(python3 << PY
import os, json, hmac, hashlib, base64, time, urllib.parse
from pathlib import Path

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

root = Path("${ROOT}")
env = {}
for line in (root / ".env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"')
secret = os.environ.get("JWT_SECRET") or env.get("JWT_SECRET", "")
user_id = "${PHOENIX_OAUTH_USER_ID:-cmppugmro0000l5043can4m0k}"
app_id = env.get("META_APP_ID", "27447238071580159")
api_v = env.get("META_API_VERSION", "v25.0")
redirect = "https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback"
scopes = "public_profile,email,ads_management,ads_read,business_management,pages_manage_metadata,pages_show_list,pages_read_engagement,whatsapp_business_management,whatsapp_business_messaging,instagram_basic,instagram_manage_messages,pages_manage_posts,instagram_content_publish,pages_messaging"
header = b64url(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
payload = b64url(json.dumps({"purpose":"meta_oauth","userId":user_id,"iat":int(time.time()),"exp":int(time.time())+600}).encode())
sig = b64url(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
state = f"{header}.{payload}.{sig}"
q = urllib.parse.urlencode({
    "client_id": app_id,
    "redirect_uri": redirect,
    "state": state,
    "scope": scopes,
    "response_type": "code",
})
print(f"https://www.facebook.com/{api_v}/dialog/oauth?{q}")
PY
)
fi

if [[ -z "$URL" ]]; then
  echo "ERRO: não foi possível gerar URL OAuth."
  exit 1
fi

# Inclui pages_messaging se a API deployada ainda não tiver no escopo padrão
URL=$(python3 << PY
import urllib.parse as u
url = """$URL"""
extra = "${EXTRA_SCOPE}".strip()
if not extra:
    print(url)
    raise SystemExit
parsed = u.urlparse(url)
q = u.parse_qs(parsed.query, keep_blank_values=True)
scopes = q.get("scope", [""])[0].split(",")
for s in extra.split(","):
    s = s.strip()
    if s and s not in scopes:
        scopes.append(s)
q["scope"] = [",".join(scopes)]
new_q = u.urlencode({k: v[0] for k, v in q.items()})
print(u.urlunparse(parsed._replace(query=new_q)))
PY
)

echo ""
echo "$URL"
echo ""
if command -v open >/dev/null; then
  open "$URL"
  echo "Abrindo OAuth Meta (token servidor / Neon). Operação diária: ./scripts/phoenix-open-omnichannel.sh"
  echo "Após autorizar: ./scripts/phoenix-meta-full-auto.sh"
else
  echo "Abra a URL acima. Depois: ./scripts/phoenix-meta-full-auto.sh"
  echo "Painel omnichannel: ./scripts/phoenix-open-omnichannel.sh"
fi
