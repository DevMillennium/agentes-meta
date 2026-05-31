#!/usr/bin/env bash
# Gera uma página HTML local de teste com o widget Phoenix embutido e abre no browser.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[[ -f .env.chatwoot ]] && source .env.chatwoot
[[ -f .env ]] && source .env

BASE="${PHOENIX_OMNICHANNEL_URL:-${FRONTEND_URL:-http://localhost:3001}}"
BASE="${BASE%/}"
TOKEN=$(docker compose -f docker-compose.chatwoot.yml exec -T chatwoot-rails bundle exec rails runner \
  'puts Channel::WebWidget.joins(:inbox).first&.website_token' 2>/dev/null | tail -1)

if [[ -z "$TOKEN" || "$TOKEN" == "nil" ]]; then
  echo "ERRO: sem widget (Channel::WebWidget). Rode ./phoenix p1 primeiro."
  exit 1
fi

OUT="$ROOT/branding/widget-test.html"
cat >"$OUT" <<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Teste Widget — Phoenix Digital Omnichannel</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; background: #f8f6f1; color: #1a1a1a; margin: 0; padding: 4rem 1.5rem; }
    .box { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid rgba(201,162,39,.25); border-radius: 16px; padding: 2.5rem; box-shadow: 0 12px 40px rgba(10,10,10,.08); }
    h1 { color: #8b6914; }
    code { background: rgba(0,0,0,.05); padding: .15rem .4rem; border-radius: 4px; font-size: .85rem; }
    .tag { display:inline-block; background: rgba(201,162,39,.12); color:#8b6914; font-size:.7rem; font-weight:700; text-transform:uppercase; padding:.2rem .5rem; border-radius:4px; }
  </style>
</head>
<body>
  <div class="box">
    <span class="tag">Phoenix Digital Omnichannel</span>
    <h1>Página de teste do widget</h1>
    <p>O chat deve aparecer no canto inferior direito. Clique e envie uma mensagem — ela cai na caixa <strong>Chat Phoenix — Website</strong> do painel.</p>
    <p>Base: <code>${BASE}</code><br>Token: <code>${TOKEN}</code></p>
    <p>Se não aparecer, confirme que o tunnel está ativo (<code>./phoenix sync-url</code>) e recarregue.</p>
  </div>
  <!-- Phoenix Digital Omnichannel — Widget -->
  <script>
    window.chatwootSettings = { locale: 'pt_BR', position: 'right' };
    (function(d,t) {
      var BASE_URL='${BASE}';
      var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
      g.src=BASE_URL+'/packs/js/sdk.js';
      g.defer=true; g.async=true;
      s.parentNode.insertBefore(g,s);
      g.onload=function(){
        window.chatwootSDK.run({ websiteToken: '${TOKEN}', baseUrl: BASE_URL });
      };
    })(document,'script');
  </script>
</body>
</html>
HTML

echo "Página gerada: $OUT"
open "$OUT" 2>/dev/null || echo "Abra manualmente: file://$OUT"
