# Integração Chatwoot + Meta + Backend Phoenix

Documento técnico da camada omnichannel: recebe webhooks Meta, normaliza eventos, sincroniza com Chatwoot, roteia IA/handoff humano e devolve respostas de atendentes ao canal correto.

## 1. Diagnóstico do projeto atual

### Stack

| Camada | Tecnologia |
|--------|------------|
| Monorepo | npm workspaces (`apps/api`, `apps/web`, `packages/shared`) |
| API | Node.js + **Express 5** + TypeScript |
| ORM | **Prisma** + PostgreSQL |
| Filas | **BullMQ** + Redis (opcional, `ENABLE_WORKERS`) |
| IA | OpenAI + Ollama (`AI_PROVIDER=auto`) |
| Deploy API | **Vercel** (`api/index.ts` → `createApp()`) |
| Deploy Web | Vercel (`apps/web`, Next.js) |
| Meta | OAuth, Graph API, webhooks legados |

### O que já existia (preservado)

- `GET/POST /webhooks/whatsapp` — verificação + assinatura `X-Hub-Signature-256`
- `GET/POST /webhooks/instagram` — mesmo padrão
- Pipeline legado: `inbound-events.parser` → Prisma (Lead/Conversation/Message) → agentes IA → envio Meta
- `MetaApiService` com envio WhatsApp e Instagram
- Console operacional em `/console`, emulador em `/tools/emulator`

### O que foi adicionado (modular, aditivo)

| Componente | Responsabilidade |
|------------|------------------|
| `MetaWebhookController` | `GET/POST /webhooks/meta` unificado |
| `MetaWebhookService` | Orquestra normalização → Chatwoot → IA |
| `MessageNormalizer` | Formato interno canal-agnóstico |
| `ChatwootService` | Client HTTP Application API v1 |
| `ChatwootSyncService` | contato → conversa → mensagem incoming |
| `AiRoutingService` | `shouldAutoReply` / `generateReply` |
| `HumanHandoffService` | nota privada + status `pending` |
| `MetaOutboundService` | envio WhatsApp / Instagram / Messenger |
| `ChatwootWebhookService` | outgoing humano → Meta (anti-loop) |
| Prisma FASE 9 | `Company`, `MetaIntegration`, `ChatwootAccount`, etc. |

---

## 2. Arquitetura recomendada

```
Meta App (IG / Messenger / WhatsApp)
        │ webhooks
        ▼
Backend Phoenix (Vercel ou local :4000)
  POST /webhooks/meta
        │ MessageNormalizer
        ▼
  ChatwootSyncService ──► Chatwoot API (self-hosted)
        │                      │
        │ AiRoutingService     │ UI atendentes
        │ (se elegível)        │
        ▼                      │
  MetaOutboundService ◄────────┘
        │ POST /webhooks/chatwoot (outgoing humano)
        ▼
Usuário final no canal Meta
```

### Separação de responsabilidades

- **Phoenix API (Vercel)**: webhooks, normalização, roteamento IA, ponte Meta ↔ Chatwoot
- **Chatwoot (Docker/VPS)**: inbox, contatos, conversas, atendentes humanos
- **PostgreSQL Phoenix**: CRM, campanhas, leads, entidades SaaS futuras
- **PostgreSQL Chatwoot**: banco **separado** (porta `5433` local)

---

## 3. Arquivos criados / alterados

### Novos

```
apps/api/src/modules/chatwoot/
  chatwoot.service.ts
  chatwoot.types.ts
apps/api/src/modules/integration/
  types.ts
  message-normalizer.ts
  meta-webhook.controller.ts
  meta-webhook.service.ts
  chatwoot-sync.service.ts
  chatwoot-webhook.controller.ts
  chatwoot-webhook.service.ts
  ai-routing.service.ts
  human-handoff.service.ts
  meta-outbound.service.ts
  *.test.ts
docker-compose.chatwoot.yml
.env.chatwoot.example
docs/chatwoot-meta-integration.md
```

### Alterados (aditivo)

```
apps/api/src/app.ts              — registra /webhooks/meta e /webhooks/chatwoot
apps/api/src/config/env.ts       — variáveis CHATWOOT_*
apps/api/src/modules/meta/services/meta-api.service.ts — sendMessengerTextMessage
prisma/schema.prisma             — modelos SaaS FASE 9
.env.example / .env.cloud.example
package.json                     — scripts chatwoot:*
```

---

## 4. Variáveis de ambiente

### Meta (já existentes)

```env
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=      # alias do plano: META_VERIFY_TOKEN
META_ACCESS_TOKEN=              # ou OAuth por usuário
META_PAGE_ID=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
WHATSAPP_PHONE_NUMBER_ID=
```

### Chatwoot (novas)

```env
CHATWOOT_ENABLED="true"
CHATWOOT_BASE_URL="http://localhost:3001"
CHATWOOT_ACCOUNT_ID="1"
CHATWOOT_API_ACCESS_TOKEN=""
CHATWOOT_INBOX_ID_INSTAGRAM=""
CHATWOOT_INBOX_ID_FACEBOOK=""
CHATWOOT_INBOX_ID_WHATSAPP=""
CHATWOOT_WEBHOOK_SECRET=""
```

### IA

```env
AI_PROVIDER=auto                # auto | openai | ollama | anthropic
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

> Com `CHATWOOT_ENABLED=false`, o backend continua no fluxo legado (`/webhooks/whatsapp`, `/webhooks/instagram`).

---

## 5. Rodar localmente

### Bootstrap automático (recomendado)

```bash
npm run chatwoot:bootstrap   # Docker + Chatwoot + inboxes + .env
npm run dev:api              # reinicie a API após o bootstrap
npm run integracao:simular   # testa /webhooks/instagram (URL do app Meta)
```

### 5.1 Backend Phoenix

```bash
cp .env.example .env
npm install
npm run db:up                    # Postgres + Redis Phoenix (5432, 6379)
npm run prisma:push
npm run dev:api                  # http://localhost:4000
```

### 5.2 Chatwoot (stack isolada)

```bash
cp .env.chatwoot.example .env.chatwoot
# Edite SECRET_KEY_BASE: openssl rand -hex 64
npm run chatwoot:up
npm run chatwoot:prepare         # db:chatwoot_prepare (primeira vez)
npm run chatwoot:logs
```

UI: **http://localhost:3001**

1. Crie conta admin no primeiro acesso
2. Crie **3 inboxes API** (Instagram, Facebook, WhatsApp) ou use um inbox API genérico por canal
3. **Settings → Applications → Access Token** → copie token e `account_id`
4. Preencha `.env` do Phoenix com IDs dos inboxes

### 5.3 Túnel para webhooks (dev)

Meta e Chatwoot precisam alcançar sua API:

```bash
# Ex.: ngrok, cloudflared
cloudflared tunnel --url http://localhost:4000
```

Configure:

| Origem | URL callback |
|--------|--------------|
| Meta App | `https://SEU_TUNEL/webhooks/meta` |
| Chatwoot webhook | `https://SEU_TUNEL/webhooks/chatwoot?secret=SEU_SEGREDO` |

Verify token Meta = `META_WEBHOOK_VERIFY_TOKEN` no `.env`.

### 5.4 Ativar integração no Phoenix

```env
CHATWOOT_ENABLED=true
CHATWOOT_BASE_URL=http://localhost:3001
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_API_ACCESS_TOKEN=seu_token
CHATWOOT_INBOX_ID_INSTAGRAM=2
CHATWOOT_INBOX_ID_FACEBOOK=3
CHATWOOT_INBOX_ID_WHATSAPP=4
```

Reinicie a API.

---

## 6. Vercel (produção)

### API (`phoenix-marketing-api`)

| Item | Valor |
|------|-------|
| Entry | `api/index.ts` |
| Webhook Meta recomendado | `https://phoenix-marketing-api.vercel.app/webhooks/meta` |
| Webhook Chatwoot | `https://phoenix-marketing-api.vercel.app/webhooks/chatwoot?secret=...` |
| Workers | `ENABLE_WORKERS=false` (sem Redis na Vercel) |
| Chatwoot | **Não roda na Vercel** — use VPS/Docker com URL pública |

### Limitações Vercel

1. **Timeout 60s** — webhooks respondem rápido (ack) e processam inline; volume alto exige fila externa (Upstash Redis).
2. **Chatwoot local** não é acessível pela Vercel — use domínio público ou túnel permanente.
3. **Dois bancos**: Neon (Phoenix) + Postgres Chatwoot no servidor do Chatwoot.

### Variáveis extras na Vercel

Copie de `.env.cloud.example` as variáveis `CHATWOOT_*` com `CHATWOOT_BASE_URL` apontando para seu Chatwoot em produção.

---

## 7. Endpoints

| Método | Rota | Função |
|--------|------|--------|
| GET/POST | `/webhooks/whatsapp` | **Legado (app Meta atual)** + ponte Chatwoot quando `CHATWOOT_ENABLED=true` |
| GET/POST | `/webhooks/instagram` | **Legado (app Meta atual)** + ponte Chatwoot quando `CHATWOOT_ENABLED=true` |
| GET | `/webhooks/meta` | Webhook unificado (opcional; não exige alterar app Meta) |
| POST | `/webhooks/meta` | Eventos Meta unificados → Chatwoot + IA |
| POST | `/webhooks/chatwoot` | Outgoing humano → Meta |

> **Sem alterar o app Meta:** mantenha as URLs `/webhooks/whatsapp` e `/webhooks/instagram`.
> A ponte `legacy-webhook-bridge.service.ts` espelha automaticamente no Chatwoot.

---

## 8. Formato interno normalizado

```json
{
  "platform": "instagram",
  "externalUserId": "17841400000000123",
  "externalConversationId": "17841405786843323",
  "messageId": "mid.abc123",
  "messageType": "text",
  "text": "Olá, quero comprar",
  "attachments": [],
  "timestamp": "2026-05-29T12:00:00.000Z",
  "rawPayload": {}
}
```

---

## 9. Exemplos de payload

### Meta — Instagram Direct

```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841405786843323",
    "messaging": [{
      "sender": { "id": "1234567890" },
      "recipient": { "id": "17841405786843323" },
      "timestamp": 1710000000000,
      "message": { "mid": "mid.$123", "text": "Tem estoque?" }
    }]
  }]
}
```

### Meta — WhatsApp Cloud

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": { "phone_number_id": "123456789" },
        "contacts": [{ "wa_id": "5585999999999", "profile": { "name": "João" } }],
        "messages": [{
          "from": "5585999999999",
          "id": "wamid.HBgN...",
          "timestamp": "1710000000",
          "type": "text",
          "text": { "body": "Qual o valor?" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Chatwoot — message_created (outgoing humano)

```json
{
  "event": "message_created",
  "message_type": 1,
  "content": "Olá! Sou a Maria, como posso ajudar?",
  "private": false,
  "conversation": {
    "id": 42,
    "inbox_id": 2,
    "additional_attributes": { "platform": "instagram" },
    "contact_inbox": { "source_id": "1234567890" }
  }
}
```

Mensagens com `content_attributes.automated: true` são **ignoradas** (anti-loop com respostas da IA).

---

## 10. Fluxo completo (checklist de aceite)

- [ ] Chatwoot sobe: `npm run chatwoot:up` + `npm run chatwoot:prepare`
- [ ] API Phoenix sobe: `npm run dev:api`
- [ ] `GET /webhooks/meta?hub.mode=subscribe&hub.verify_token=...&hub.challenge=OK` retorna `OK`
- [ ] POST simulado Meta aparece no Chatwoot (contato + conversa + mensagem)
- [ ] IA responde (se `OPENAI_API_KEY` ou Ollama ativo) e registra outgoing no Chatwoot
- [ ] Atendente responde no Chatwoot → usuário recebe no Instagram/WhatsApp/Messenger
- [ ] Logs pino mostram `meta-webhook`, `chatwoot-sync`, `chatwoot-webhook`
- [ ] Tokens apenas em `.env` / Vercel env (nunca no código)
- [ ] Webhooks legados `/webhooks/whatsapp` e `/webhooks/instagram` ainda funcionam

### Testar verificação Meta

```bash
curl "http://localhost:4000/webhooks/meta?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=12345"
# Esperado: 12345
```

### Testar emulador existente

Use `/tools/emulator` no console — para o pipeline Chatwoot, aponte o app Meta para `/webhooks/meta` ou envie POST manual com assinatura HMAC.

---

## 11. Testes automatizados

```bash
npm run test --workspace @phoenix/api
```

Cobertura mínima:

- `message-normalizer.test.ts` — WhatsApp, Instagram, Messenger, anti-echo
- `chatwoot-webhook.service.test.ts` — anti-loop, reenvio humano
- `ai-routing.service.test.ts` — handoff e intenção humana

---

## 12. Riscos técnicos

| Risco | Mitigação |
|-------|-----------|
| Loop Meta ↔ Chatwoot | Flag `content_attributes.automated` + ignorar incoming/echo |
| Chatwoot inacessível na Vercel | URL pública; `CHATWOOT_ENABLED=false` fallback |
| Timeout serverless | Ack imediato; migrar para fila Upstash se volume crescer |
| Inbox errado por canal | Mapear `CHATWOOT_INBOX_ID_*` por plataforma |
| Token Meta expirado | OAuth + `POST /api/meta/sync-assets` |
| Dois pipelines paralelos | Use `/webhooks/meta` OU legado, não ambos no mesmo app Meta |
| SaaS multiempresa | Modelos Prisma prontos; resolução por `Company` ainda via `.env` |

---

## 13. Credenciais reais necessárias

1. **Meta Developers** — App ID, Secret, Verify Token, Page token (OAuth)
2. **Instagram** — conta profissional vinculada à Page, permissões messaging
3. **WhatsApp** — WABA + Phone Number ID (futuro/imediato conforme app)
4. **Chatwoot** — Access Token de agente/admin, Account ID, Inbox IDs
5. **OpenAI/Ollama** — para respostas automáticas
6. **Vercel** — `DATABASE_URL` Neon, segredos Meta e Chatwoot
7. **Túnel/domínio** — webhooks alcançáveis na internet

---

## 14. Ordem segura de implementação (status)

| Fase | Status |
|------|--------|
| 1 Diagnóstico | ✅ |
| 2 Docker Chatwoot | ✅ `docker-compose.chatwoot.yml` |
| 3 ChatwootService | ✅ |
| 4 Webhook Meta unificado | ✅ |
| 5 MessageNormalizer | ✅ |
| 6 Sync Chatwoot | ✅ |
| 7 IA + handoff | ✅ |
| 8 Webhook Chatwoot | ✅ |
| 9 Entidades SaaS Prisma | ✅ (schema; lógica multi-tenant futura) |
| Docs + testes | ✅ |

### Próximos passos (evolução plataforma)

1. Resolver `Company` + `Channel` em runtime (substituir `.env` single-tenant)
2. Fila Upstash Redis na Vercel para processamento assíncrono
3. Suporte mídia (imagem/áudio) download Meta → upload Chatwoot
4. Painel Phoenix para regras de roteamento (`ConversationRoutingRule`)
5. Integração n8n via webhook Chatwoot → backend

---

## 15. Referências

- [Chatwoot GitHub](https://github.com/chatwoot/chatwoot)
- [Chatwoot Developers](https://developers.chatwoot.com/introduction)
- [Meta Messenger Webhooks](https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks)
- [Meta Instagram Webhooks](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks)
- Deploy Phoenix: `docs/vercel-deploy.md`
