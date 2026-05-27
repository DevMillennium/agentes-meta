# Phoenix Global Marketing AI Team

Monorepo inicial para a operacao multiagente de marketing da Phoenix Global, com foco em arquitetura limpa, seguranca e escalabilidade antes das integracoes reais com a Meta.

## Stack

- `apps/web`: Next.js (dashboard inicial)
- `apps/api`: Node.js + Express + TypeScript (modulos e agentes)
- `prisma`: PostgreSQL + Prisma schema
- `packages/shared`: tipos compartilhados
- Redis + BullMQ (preparado para fila na fase seguinte)

## Estrutura

```txt
apps/
  web/
  api/
packages/
  shared/
prisma/
docs/
```

## Modulos iniciais na API

- Auth (base estrutural preparada)
- Meta Integration (`MetaApiService`: WhatsApp/Instagram reais quando token + IDs; Marketing/Insights ainda placeholders)
- Products, Campaigns, Approvals (endpoints iniciais)
- Agent Orchestrator (`AgentOrchestrator`)
- Agentes:
  - `MarketingDirectorAgent`
  - `PaidTrafficStrategistAgent`
  - `PerformanceAnalystAgent`
  - `AdCopywriterAgent`
  - `PostCreatorAgent`
  - `MetaComplianceAgent`
  - `WhatsAppSalesAgent`
  - `InstagramDirectAgent`
  - `ProductManagerAgent`
  - `CRMFollowUpAgent`

## Endpoints iniciais

- `GET /` — menu de ferramentas (hub)
- `GET /console` — painel operacional no navegador
- `GET /tools/emulator` — emulador de webhooks
- `GET /tools/leads` — CRM de leads
- `GET /health`
- `GET /api/leads` — CRM (lista, stats, detalhe, PATCH)
- `POST /api/conversations/:id/messages` — resposta humana outbound
- `GET /api/products`
- `POST /api/campaigns/diagnose`
- `POST /api/agents/orchestrate`
- `GET /api/approvals`
- `POST /api/approvals`
- `POST /api/approvals/:id/decide`
- `GET /webhooks/whatsapp` (verificacao Meta)
- `POST /webhooks/whatsapp`
- `GET /webhooks/instagram` (verificacao Meta)
- `POST /webhooks/instagram`

Rotas `/api/*` exigem autenticação: `Authorization: Bearer <jwt>` (via `POST /api/auth/login`) **ou** `x-api-key` com `ADMIN_API_KEY`.

## Como rodar local

1. Copie variaveis:

```bash
cp .env.example .env
```

2. Instale dependencias:

```bash
npm install
```

3. Gere o client Prisma:

```bash
npm run prisma:generate
```

4. Suba PostgreSQL (escolha uma opcao):

- **Docker (recomendado):** `npm run db:up` (usa `docker-compose.yml` na raiz).
- **Homebrew:** `brew install postgresql@16 && brew services start postgresql@16` e crie o banco `phoenix_marketing_ai` com usuario `postgres`/senha `postgres` (ou ajuste o `DATABASE_URL` no `.env`).

5. Aplique o schema no banco:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/phoenix_marketing_ai?schema=public"
npm run prisma:push
```

6. Suba API:

```bash
npm run dev:api
```

Centro de ferramentas (mesmo endereço da API): `http://localhost:4000/`

- **Console** — `/console` (agentes, Meta, produtos, conversas)
- **Emulador** — `/tools/emulator` (webhooks WhatsApp/Instagram)
- **CRM Leads** — `/tools/leads`

Emulação pré-deploy: `npm run emulate` (ou `EMULATE_NO_WAIT=1 npm run emulate` para só testes automatizados).

7. Suba dashboard:

```bash
npm run dev:web
```

## Variaveis de ambiente principais

Veja `.env.example`:

- `DATABASE_URL`
- `REDIS_URL`
- `API_CORS_ORIGIN`
- `ADMIN_API_KEY`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `JWT_SECRET` / `JWT_EXPIRES_IN`
- `ENABLE_WORKERS`
- `OPENAI_API_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN`
- `META_API_VERSION`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_HTTP_TIMEOUT_MS` / `META_HTTP_RETRIES`
- `WHATSAPP_PHONE_NUMBER_ID`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `NEXT_PUBLIC_API_URL`

## Observacoes de seguranca

- Orcamento nao deve ser alterado sem aprovacao.
- Nenhuma campanha deve ser criada sem produto valido.
- Produtos sensiveis exigem compliance.
- Toda decisao de agente deve conter justificativa e log.
