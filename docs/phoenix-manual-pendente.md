# Phoenix Omnichannel — o que só você pode fazer manualmente

Gerado após `./scripts/phoenix-go-live-full-auto.sh`. Tudo abaixo **não** tem API estável ou exige login humano no Meta/Facebook.

---

## 1. Meta Developer Console (obrigatório para produção)

| Ação | Onde |
|------|------|
| Confirmar **Callback URL** = `{FRONTEND_URL}/webhooks/meta` | App → Webhooks |
| **Verify token** = mesmo valor de `META_WEBHOOK_VERIFY_TOKEN` no `.env.chatwoot` | Webhooks |
| Se o tunnel mudou, **atualizar URL** e clicar **Verify and save** | Webhooks |
| **Instagram Login** — criar produto e copiar **Instagram App ID** (≠ `FB_APP_ID`) | Produtos → Instagram |
| Colar `INSTAGRAM_APP_ID` em `.env` e rodar `./phoenix p1` + `./phoenix meta` | — |
| OAuth redirect URIs para o domínio **fixo** de produção | Facebook Login → Settings |

App: https://developers.facebook.com/apps/27447238071580159/

---

## 2. Domínio fixo (substituir Cloudflare temporário)

- Contratar DNS (ex. `omnichannel.phoenixglobal.com.br`) apontando para o servidor ou Vercel/tunnel estável.
- Atualizar `FRONTEND_URL`, `PHOENIX_OMNICHANNEL_URL`, webhooks Meta, OAuth.
- Rodar: `./phoenix sync-url` (ou `./scripts/phoenix-sync-public-url.sh`).

---

## 3. Teste real no celular (Messenger / Instagram)

1. Abra a página **Phoenix Global Import** no Facebook.
2. Envie **“Olá”** pelo Messenger (ou DM Instagram da conta business).
3. No painel: `/app` → inbox → conversa **pending** → resposta da **Fernanda**.

Se não aparecer: confira se o webhook no Meta aponta para a URL **atual** do tunnel.

---

## 3b. Widget no site (P1 — manual: colar no HTML)

1. Abra `/comecar/widget` (ou tunnel `/comecar/widget`).
2. Clique **Copiar código** e cole antes de `</body>` em https://phoenixglobal.com.br
3. Arquivo de referência: `chatwoot/public/brand-assets/phoenix-widget-snippet.html`

---

## 4. WhatsApp Business Cloud (P1)

- `./phoenix connect whatsapp`
- Meta → produto WhatsApp → número + template aprovado.
- Concluir Embedded Signup no painel Chatwoot.

---

## 5. E-mail (SMTP / Google / Microsoft)

- Configurações → Caixas → E-mail → credenciais do provedor.

---

## 6. OAuth Neon / phoenix-marketing-api

Se `./phoenix meta` falhar com “sem UserMetaConnection”:

1. Rodar OAuth em `phoenix-marketing-api.vercel.app`.
2. Ou `./phoenix oauth` e autorizar no browser.

---

## 7. Playwright / browser (opcional)

```bash
node scripts/meta-oauth-redirect-playwright.mjs
```

Só se redirects OAuth no Meta estiverem incorretos.

---

## P3 — Comentários em posts/stories (só se negócio exigir)

Ver [phoenix-p3-comments-roadmap.md](./phoenix-p3-comments-roadmap.md) — não implementado; use DM + Captain.

## Comandos úteis pós-manual

```bash
./phoenix go-live      # repetir automação (inclui seed)
./phoenix p1           # widget + Instagram ID
./phoenix seed         # respostas prontas + labels + automação
./phoenix widget-test  # página local de teste do widget
./phoenix verify
./phoenix e2e          # simular DM local
./phoenix open
open http://localhost:3001/comecar/integracoes
```

## Login da landing — o que funciona

A home (`/`) tem duas faixas:

- **Acessar:** `E-mail` (sempre funciona, login/senha do Chatwoot) e `Google`
  (aparece só quando o Google OAuth está configurado — ver abaixo).
- **Conectar canal:** `Facebook` e `Instagram` levam ao fluxo de conexão real
  (`/comecar/canais`), que usa o OAuth Meta do `phoenix-marketing-api`. Esse é o
  "login com Facebook" que de fato funciona aqui (conecta páginas/Messenger/IG).

### Google OAuth (SSO no dashboard) — requer credenciais
Para o botão Google ficar ativo: criar OAuth Client no Google Cloud Console e definir
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e
`GOOGLE_OAUTH_CALLBACK_URL=<URL pública>/omniauth/google_oauth2/callback`
em `.env.chatwoot`, depois recriar o `chatwoot-rails`.

### Facebook como SSO do dashboard — não é nativo
O Chatwoot **não** suporta "Entrar com Facebook" no painel de agentes por padrão (só
Google). Habilitar exigiria rebuild da imagem com `omniauth-facebook` — fica fora do
escopo para não arriscar a instalação atual. O Facebook já é usado para **canais**
(Messenger/Instagram), que estão operacionais.

## Meta app (27447238071580159 — "Phoenix Marketing Automat") — JÁ CONFIGURADA
- Webhooks `page` e `instagram` **ativos** → `<tunnel>/webhooks/meta`.
- `app_domains` inclui Vercel, localhost e o túnel atual.
- Callback OAuth: `https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback`.
- Reconfigurar quando o túnel mudar: `./phoenix sync-url && ./scripts/phoenix-meta-full-auto.sh`.
