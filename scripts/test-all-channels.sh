#!/usr/bin/env bash
# Sync Meta assets + testa Instagram, Facebook e WhatsApp simulados + verifica Chatwoot.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
set -a; source .env; set +a

API="${API_PUBLIC_URL:-http://localhost:4000}"
API="${API%/}"
KEY="${ADMIN_API_KEY:?ADMIN_API_KEY ausente no .env}"
CW_BASE="${CHATWOOT_BASE_URL:-http://localhost:3001}"
CW_BASE="${CW_BASE%/}"

echo "════════════════════════════════════════════════════════"
echo "  Phoenix — Sync Meta + Teste 3 Canais + Chatwoot"
echo "════════════════════════════════════════════════════════"

echo ""
echo "==> [1/4] Health API..."
curl -sf "${API}/health" | node -pe "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('API ok:', j.ok); JSON.stringify(j,null,2)" 2>/dev/null || {
  echo "API offline. Rode: npm run dev:api"
  exit 1
}

echo ""
echo "==> [2/4] POST /api/meta/sync-assets..."
SYNC=$(curl -sf -X POST "${API}/api/meta/sync-assets" -H "x-api-key: ${KEY}" -H "Content-Type: application/json" 2>&1) || SYNC='{"error":"sync falhou — conecte Meta OAuth em /console"}'
echo "$SYNC" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(d);
    if (j.steps?.syncAssets?.ok) console.log('✅ Assets sincronizados');
    else if (j.error) console.log('⚠️ ', j.error);
    else console.log(JSON.stringify(j,null,2).slice(0,800));
  } catch { console.log(d.slice(0,500)); }
})"

echo ""
echo "==> [3/4] GET /api/meta/production-readiness..."
curl -sf "${API}/api/meta/production-readiness" -H "x-api-key: ${KEY}" 2>/dev/null | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(d);
    console.log('Readiness ok:', j.ok);
    if (j.checks) for (const [k,v] of Object.entries(j.checks)) console.log(' ', k+':', (v as any).ok ?? v);
  } catch { console.log('(readiness indisponível)'); }
})" || echo "⚠️  production-readiness indisponível (OAuth pode ser necessário)"

echo ""
echo "==> [4/4] Simulando Instagram + Facebook + WhatsApp..."
npx tsx scripts/simulate-meta-webhook.ts all

echo "Aguardando sync Chatwoot (6s)..."
sleep 6

if [[ -n "${CHATWOOT_API_ACCESS_TOKEN:-}" ]]; then
  echo ""
  echo "==> Verificação Chatwoot..."
  curl -sf -H "api_access_token: ${CHATWOOT_API_ACCESS_TOKEN}" \
    "${CW_BASE}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID:-1}/contacts" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(d);
    const list=j.payload||[];
    console.log('Contatos totais:', list.length);
    list.slice(-5).forEach((c:any)=>console.log(' -', c.id, c.name||c.identifier, c.contact_inboxes?.[0]?.inbox?.name||''));
  } catch(e){ console.log('Erro ao ler contatos'); }
})"

  for pair in "Instagram (Meta):${CHATWOOT_INBOX_ID_INSTAGRAM:-1}" "Facebook (Meta):${CHATWOOT_INBOX_ID_FACEBOOK:-2}" "WhatsApp (Meta):${CHATWOOT_INBOX_ID_WHATSAPP:-3}"; do
    NAME="${pair%%:*}"
    INBOX="${pair##*:}"
    COUNT=$(curl -sf -H "api_access_token: ${CHATWOOT_API_ACCESS_TOKEN}" \
      "${CW_BASE}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID:-1}/conversations?inbox_id=${INBOX}&status=all" 2>/dev/null | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  try{const j=JSON.parse(d);const l=j.data?.payload||j.payload||[];console.log(Array.isArray(l)?l.length:0)}catch{console.log(0)}
})" || echo "0")
    echo "  Inbox ${NAME}: ${COUNT} conversa(s)"
  done
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Teste concluído"
echo "   Chatwoot: npm run chatwoot:open"
echo "   Console:  ${API}/console"
echo "════════════════════════════════════════════════════════"
