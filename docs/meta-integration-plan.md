# Plano de Integração Meta — Phoenix Digital Omnichannel (Fase 4)

**App ID conhecido:** `27447238071580159`  
**Produtos Meta:** Messenger, Graph API Instagram, Facebook Login, Marketing API, Webhooks

---

## 1. Inventário no Chatwoot (estado atual)

### Configuração (`config/installation_config.yml` + ENV)

| Chave | Uso |
|-------|-----|
| `FB_APP_ID` | Login / Messenger / páginas |
| `FB_APP_SECRET` | Assinatura webhook, Graph API |
| `FB_VERIFY_TOKEN` | Verificação webhook Messenger (`/bot`) |
| `IG_VERIFY_TOKEN` | Webhook Instagram via página FB |
| `INSTAGRAM_VERIFY_TOKEN` | Webhook Instagram login direto |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Instagram API |
| `FACEBOOK_API_VERSION` | Versão Graph (default `v18.0`) |
| `INSTAGRAM_API_VERSION` | Instagram Graph (default `v22.0`) |
| `META_WEBHOOK_VERIFY_TOKEN` | **Phoenix** — `/webhooks/meta` (ENV) |
| `META_APP_SECRET` | **Phoenix** — assinatura unificada (ENV) |

### OAuth e callbacks

| Rota / componente | Função |
|-------------------|--------|
| `POST/GET .../callbacks#register_facebook_page` | Conectar página Facebook |
| `POST .../callbacks#facebook_pages` | Listar páginas |
| `POST .../callbacks#reauthorize_page` | Reautorizar token de página |
| `app/controllers/instagram/` | Fluxo Instagram (login direto) |
| `app/controllers/api/v1/accounts/instagram/` | API conta ↔ Instagram |
| `config/initializers/facebook_messenger.rb` | Provider `ChatwootFbProvider`, rota **`/bot`** |

### Webhooks

| Endpoint | Handler | Objeto Meta |
|----------|---------|-------------|
| `GET/POST /webhooks/instagram` | `Webhooks::InstagramController` | `instagram` |
| `GET/POST /webhooks/meta` | `Webhooks::MetaController` (Phoenix) | `instagram`, `page` |
| `POST /bot` (gem) | `Facebook::Messenger::Server` | Messenger `page` |
| `GET/POST /webhooks/whatsapp/:phone` | WhatsApp Cloud API (Meta) | `whatsapp` |

### Jobs

| Job | Canal |
|-----|-------|
| `Webhooks::InstagramEventsJob` | Instagram DM, messaging híbrido |
| `Webhooks::FacebookEventsJob` | Messenger (página) |
| `Webhooks::FacebookDeliveryJob` | Entrega/leitura Messenger |
| `Webhooks::WhatsappEventsJob` | WhatsApp |

### Services (envio)

- `app/services/facebook/send_on_facebook_service.rb`  
- `app/services/instagram/send_on_instagram_service.rb`  
- `app/services/instagram/messenger/send_on_instagram_service.rb`  
- `app/services/whatsapp/facebook_api_client.rb`  

---

## 2. Mapeamento por produto Meta

### Instagram DM

| Item | Detalhe |
|------|---------|
| Model | `Channel::Instagram` |
| Webhook | `/webhooks/instagram` ou `/webhooks/meta` (object `instagram`) |
| Graph | `graph.instagram.com` / messaging via página |
| Config Dev Console | `instagram_basic`, `instagram_manage_messages`, webhooks `messages`, `messaging_postbacks` |

### Facebook Messenger

| Item | Detalhe |
|------|---------|
| Model | `Channel::FacebookPage` |
| Webhook legado | `https://{host}/bot` |
| Webhook Phoenix | `https://{host}/webhooks/meta` (object `page`) |
| OAuth | Facebook Login + permissões `pages_messaging` |

### Facebook Login

| Item | Detalhe |
|------|---------|
| Uso | Conectar páginas e Instagram vinculado |
| Config | `FB_APP_ID`, redirect URIs no app Meta |
| UI | Settings → Inboxes → Facebook/Instagram |

### Marketing API

| Item | Detalhe |
|------|---------|
| No Chatwoot core | **Não** há módulo de ads nativo |
| Ecossistema AGENTE | `.env.example` define `META_AD_ACCOUNT_ID`, tokens — integração futura via API separada (`apps/api` legado) ou custom tool |
| Recomendação | Manter campanhas fora do inbox; sincronizar leads via webhooks custom ou Zapier |

---

## 3. URL de webhook recomendada (Meta Developer)

**Produção (Phoenix unificado):**

```
Callback URL: https://{FRONTEND_URL}/webhooks/meta
Verify Token:  {META_WEBHOOK_VERIFY_TOKEN}  (igual FB_VERIFY_TOKEN/IG se desejado)
```

**Alternativa compatível (já existente):**

- Instagram only: `/webhooks/instagram`  
- Messenger only: `/bot`  

> Evitar subscrever o mesmo app em três URLs simultâneas sem entender duplicação de eventos.

---

## 4. Assinatura `X-Hub-Signature-256`

Implementada em `MetaTokenVerifyConcern`:

- Header: `X-Hub-Signature-256: sha256={hex}`  
- Segredos testados: `META_APP_SECRET`, `FB_APP_SECRET`, `INSTAGRAM_APP_SECRET`, secrets por canal  

---

## 5. Próximos passos de integração

1. Preencher `FB_APP_ID=27447238071580159` no Super Admin  
2. Definir `META_WEBHOOK_VERIFY_TOKEN` e mesmo token no painel Meta  
3. Configurar `FRONTEND_URL` público (HTTPS)  
4. Conectar inbox Facebook e Instagram no dashboard  
5. Testar com evento de teste do Meta → logs `phoenix.meta_webhook.*`  
6. Marketing API: projeto separado documentado em roadmap Phoenix Ads  

---

*Fase 4 — documentação apenas; sem alteração de models.*
