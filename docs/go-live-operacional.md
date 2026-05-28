# Go-Live Operacional (Meta + Vercel + Phoenix)

Este checklist deixa o sistema ativo em produção com validação técnica e operacional.

## 1) Segurança inicial obrigatória

1. Rotacione segredos expostos anteriormente:
   - `META_APP_SECRET`
   - `OPENAI_API_KEY`
2. Atualize os novos valores em:
   - `.env` local
   - Vercel projeto API
   - qualquer cofre/secrets manager usado
3. Nunca use `NEXT_PUBLIC_ADMIN_API_KEY` no frontend.

## 2) Configurar Vercel (API e Web)

## Projeto API

Defina no Vercel:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_API_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `OPENAI_API_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI=https://SEU_API/api/meta/oauth/callback`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_API_VERSION=v25.0`
- `API_PUBLIC_URL=https://SEU_API`
- `WEB_APP_URL=https://SEU_WEB`
- `API_CORS_ORIGIN=https://SEU_WEB`
- `ENABLE_WORKERS=false` (Vercel serverless)

## Projeto Web

- `NEXT_PUBLIC_API_URL=https://SEU_API`
- `NEXT_PUBLIC_META_APP_ID=<mesmo META_APP_ID>`
- `NEXT_PUBLIC_META_API_VERSION=v25.0`

## Deploy

```bash
cd "/Users/thyagomesquita/Desktop/AGENTE"
npm run build
```

Depois faça deploy dos dois projetos na Vercel.

## 3) Configurar Meta Developer

No app Meta:

1. **Facebook Login / OAuth Redirect URI**
   - `https://SEU_API/api/meta/oauth/callback`
2. **Webhooks**
   - `https://SEU_API/webhooks/whatsapp`
   - `https://SEU_API/webhooks/instagram`
   - Verify token = `META_WEBHOOK_VERIFY_TOKEN`
3. Confirme permissões e produtos:
   - Marketing API
   - Webhooks
   - Instagram Graph / Messaging
   - WhatsApp Cloud API (quando aplicável)

## 4) Ativação operacional

1. Faça login no web: `/login`
2. Vá para `/configuracoes/meta`
3. Conecte Meta (SDK ou OAuth servidor)
4. Execute sync:
   - botão da UI ou `POST /api/meta/sync-assets`
5. Execute bootstrap:

```bash
API_BASE_URL="https://SEU_API" API_KEY="SUA_ADMIN_API_KEY" npm run meta:bootstrap:prod
```

## 5) Validação automática pós-ativação

```bash
API_BASE_URL="https://SEU_API" API_KEY="SUA_ADMIN_API_KEY" npm run ops:go-live-check
```

Condição de pronto:

- `/health` com `ok: true`
- `production-readiness.ok === true`
- `missing` vazio
- `marketingReady`, `whatsappReady` e `instagramReady` coerentes com seus canais

## 6) Abrir portais de validação manual

```bash
API_PUBLIC_URL="https://SEU_API" WEB_APP_URL="https://SEU_WEB" npm run ops:open-portals
```

Isso abre no Safari:

- login do web
- integração Meta no web
- console da API
- OAuth endpoint
- Meta Developers
- Meta Business
- Vercel Dashboard

## 7) Critérios finais de 100% operacional

- Autenticação web funcionando via JWT.
- Nenhuma API key pública embutida no frontend.
- Rate limit ativo em produção (API, login, webhook).
- Meta OAuth conectado por usuário.
- Sync de assets concluído.
- Webhooks verificados e recebendo eventos.
- Bootstrap Meta sem pendências.
- Deploy Web/API estável na Vercel.
