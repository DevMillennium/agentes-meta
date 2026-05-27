# Phoenix Platform API — Console & Agentes

Backend unificado para o navegador autenticar, operar agentes e conectar à Meta.

## Console web (recomendado)

Abra no navegador (com a API rodando):

**http://localhost:4000/console**

- Login Phoenix (JWT)
- Visão geral (stats + Meta)
- OAuth Meta + sync de ativos
- Executar ciclo de agentes ou agente individual
- Auditoria, produtos, conversas

## Autenticação (navegador)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | `{ email, password }` → `accessToken` |
| GET | `/api/auth/me` | Sessão + overview (Bearer) |
| POST | `/api/auth/logout` | Encerrar no cliente |

Header: `Authorization: Bearer <token>`

## Plataforma

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/platform/overview` | Bearer |
| GET | `/api/platform/health` | Público |

## Agentes

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/agents` | Catálogo dos 10 agentes |
| GET | `/api/agents/actions` | Auditoria (`?limit=50&agentName=`) |
| POST | `/api/agents/orchestrate` | Ciclo completo de marketing |
| POST | `/api/agents/:key/analyze` | Só análise |
| POST | `/api/agents/:key/run` | Análise + execução |

Chaves: `whatsappSales`, `instagramDirect`, `adCopywriter`, `paidTrafficStrategist`, `postCreator`, `metaCompliance`, `productManager`, `marketingDirector`, `performanceAnalyst`, `crmFollowUp`

## Meta (direto)

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/meta/status` | Público |
| GET | `/api/meta/session` | Público (URLs OAuth) |
| GET | `/api/meta/oauth/login` | Redirect OAuth |
| POST | `/api/meta/oauth/sdk-token` | Token do JS SDK |
| POST | `/api/meta/sync-assets` | Bearer |
| POST | `/api/meta/publish-instagram` | Bearer |
| GET | `/api/meta/adaccounts` | Bearer |
| POST | `/api/meta/campaigns` | Bearer |
| POST | `/api/meta/insights` | Bearer |

## Demais módulos

- `/api/products` — CRUD + seed
- `/api/campaigns` — campanhas e criativos
- `/api/conversations` — inbox
- `/api/approvals` — aprovações humanas
- `/webhooks/whatsapp` · `/webhooks/instagram`

## CORS

Origens permitidas: `localhost:3000`, `localhost:4000` (Next.js + Console).
