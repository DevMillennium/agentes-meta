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
- Meta Integration (`MetaApiService` com placeholders)
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

- `GET /health`
- `GET /api/products`
- `POST /api/campaigns/diagnose`
- `POST /api/agents/orchestrate`
- `POST /api/approvals`
- `POST /webhooks/whatsapp`
- `POST /webhooks/instagram`

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

4. Suba API:

```bash
npm run dev:api
```

5. Suba dashboard:

```bash
npm run dev:web
```

## Variaveis de ambiente principais

Veja `.env.example`:

- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN`
- `META_API_VERSION`
- `WHATSAPP_PHONE_NUMBER_ID`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `NEXT_PUBLIC_API_URL`

## Observacoes de seguranca

- Orcamento nao deve ser alterado sem aprovacao.
- Nenhuma campanha deve ser criada sem produto valido.
- Produtos sensiveis exigem compliance.
- Toda decisao de agente deve conter justificativa e log.
