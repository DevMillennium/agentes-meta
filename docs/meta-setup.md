# Meta Setup — Phoenix Marketing Automat

**App ID:** `27447238071580159`  
**Nome:** Phoenix Marketing Automat  
**Empresa:** Phoenix Global Imports

## 1. Variáveis no `.env`

```env
META_APP_ID="27447238071580159"
META_APP_SECRET="..."                    # nunca commitar
META_REDIRECT_URI="http://localhost:4000/api/meta/oauth/callback"
META_API_VERSION="v25.0"
META_WEBHOOK_VERIFY_TOKEN="phoenix-verify-token"
META_AD_ACCOUNT_ID="act_XXXXX"         # opcional — após listar contas
META_ACCESS_TOKEN=""                   # opcional se usar OAuth (arquivo local)
WHATSAPP_PHONE_NUMBER_ID=""
INSTAGRAM_BUSINESS_ACCOUNT_ID=""
```

O token OAuth é salvo em `.meta-token.local.json` (gitignored) após login.

## 2. Conectar token

### Opção A — SDK JavaScript (dashboard web)

1. Suba API + web:
   ```bash
   npm run start --workspace @phoenix/api
   npm run dev --workspace @phoenix/web
   ```
2. Abra: [http://localhost:3000/configuracoes/meta](http://localhost:3000/configuracoes/meta)
3. Clique **Conectar com Facebook** (usa `FB.login` + `FB.getLoginStatus`)
4. O token é enviado ao backend via `POST /api/meta/oauth/sdk-token`

### Opção B — OAuth servidor

1. Suba a API: `npm run emulate` ou `npm run start --workspace @phoenix/api`
2. Abra: [http://localhost:4000/api/meta/oauth/login](http://localhost:4000/api/meta/oauth/login)
3. Faça login com usuário Meta que administra a conta de anúncios
4. Autorize as permissões
5. Verifique: [http://localhost:4000/api/meta/status](http://localhost:4000/api/meta/status) → `hasAccessToken: true`

No **App Dashboard** → Facebook Login → Configurações → URIs de redirecionamento OAuth válidos, adicione as URLs retornadas por:

```bash
API_KEY="sua-admin-api-key" curl -s http://localhost:4000/api/meta/console-settings -H "x-api-key: $API_KEY" | jq '.facebookLoginSettings.validOAuthRedirectUris'
```

Ou abra o checklist no Chrome:

```bash
npm run meta:connect-chrome
```

Mínimo local: `http://localhost:4000/api/meta/oauth/callback`

## 3. Produtos no app (já adicionados)

- Webhooks
- API de Marketing
- API de Catálogo
- Graph API do Instagram

## 4. Webhooks locais

| Canal | URL callback | Verify token |
|-------|----------------|--------------|
| WhatsApp | `http://localhost:4000/webhooks/whatsapp` | `phoenix-verify-token` |
| Instagram | `http://localhost:4000/webhooks/instagram` | `phoenix-verify-token` |

Produção: use HTTPS público (ngrok, Cloudflare Tunnel, etc.).

## 5. Endpoints API Phoenix

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/meta/status` | Não | Status da integração |
| GET | `/api/meta/oauth/login` | Não | Inicia OAuth |
| GET | `/api/meta/me` | Sim | Perfil Graph |
| GET | `/api/meta/adaccounts` | Sim | Lista contas de anúncios |
| POST | `/api/meta/insights` | Sim | Insights reais |
| POST | `/api/meta/campaigns` | Sim | Cria campanha (PAUSED) |
| POST | `/api/campaigns/diagnose` | Sim | Diagnóstico + insights |

Emulador: [http://localhost:4000/dev/emulator](http://localhost:4000/dev/emulator)

## 6. Documentação oficial

- [Marketing API Overview](https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview#how-it-works)
- [Ads Insights API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights)
- [Rate Limiting](https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/rate-limiting)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Instagram Messaging](https://developers.facebook.com/docs/instagram-platform/instagram-messaging)

## 7. Segurança

- Rotacione `META_APP_SECRET` e `OPENAI_API_KEY` se foram expostas em chat
- Não commite `.env` nem `.meta-token.local.json`
- Em produção use **System User** no Business Manager com token long-lived
