# Phoenix Digital Omnichannel — Auditoria Total (Fase 1)

**Data:** 2026-05-29  
**Base:** Chatwoot `4.14.1` (Ruby `3.4.4`, Rails `~> 7.1`)  
**Localização do núcleo:** `chatwoot/` (clone funcional, repositório Git próprio embutido)

---

## 1. Estrutura do repositório AGENTE

```
AGENTE/
├── chatwoot/          # Núcleo Rails + Vue (Chatwoot upstream)
├── branding/          # Assets Phoenix (fonte + derivados)
├── docs/              # Documentação Phoenix
├── scripts/           # Automação (ex.: phoenix-generate-branding.py)
├── .env*              # Variáveis do ecossistema (API legada + Chatwoot)
└── .env.chatwoot.example
```

> **Nota:** O monorepo histórico (`apps/api`, `apps/web`, agents) aparece removido no Git da raiz; a missão atual opera sobre **`chatwoot/`** como fundação omnichannel.

---

## 2. Estrutura interna do Chatwoot

| Diretório | Função |
|-----------|--------|
| `app/models` | Domínio (Account, Inbox, Conversation, Channel::*) |
| `app/controllers` | API REST, dashboard, webhooks |
| `app/services` | Lógica de negócio (Facebook, Instagram, WhatsApp…) |
| `app/jobs` | Sidekiq (webhooks, entrega, sync) |
| `app/javascript` | Dashboard Vue 3 + Widget + Portal v3 |
| `config/` | Rotas, initializers, `installation_config.yml` |
| `db/migrate` | **135 migrations** — não alterar retroativamente |
| `enterprise/` | Funcionalidades EE (Captain/AI, billing hooks) |
| `docker/` | Dockerfiles Rails, Vite, produção |
| `public/brand-assets` | Logos servidos estaticamente |
| `public/` | Favicons, packs Vite, SDK widget |

### Canais omnichannel (`app/models/channel/`)

`api`, `email`, `facebook_page`, `instagram`, `line`, `sms`, `telegram`, `tiktok`, `twilio_sms`, `twitter_profile`, `web_widget`, `whatsapp`

---

## 3. Dependências principais

### Ruby (`Gemfile`)

- **Rails** ~> 7.1, **Ruby** 3.4.4  
- `rack-cors`, `sidekiq`, `devise_token_auth`  
- Integrações: Koala (Facebook Graph), gems de email, WhatsApp, etc.

### JavaScript (`package.json`)

- **Vue 3** + Vite  
- Pacotes `@chatwoot/*` (editor, utils, ninja-keys)  
- Vitest para testes frontend  

---

## 4. Docker e infraestrutura

### `docker-compose.yaml` (desenvolvimento)

| Serviço | Imagem / build | Porta |
|---------|----------------|-------|
| `rails` | chatwoot-rails:development | 3000 |
| `sidekiq` | worker | — |
| `vite` | chatwoot-vite:development | 3036 |
| `postgres` | pgvector/pgvector:pg16 | 5432 |
| `redis` | redis:alpine | 6379 |
| `mailhog` | mailhog/mailhog | 8025 (UI) |

Volumes: `postgres`, `redis`, `packs`, `node_modules`, `cache`, `bundle`.

### Produção

- `docker-compose.production.yaml`  
- Variáveis via `.env` / Super Admin → Installation Config  

---

## 5. PostgreSQL e Redis

- **DB padrão:** `chatwoot` (Postgres 16 + pgvector)  
- **Redis:** filas Sidekiq, mutex de mensagens Meta (`Redis::Alfred::*`)  
- **Não** renomear tabelas, models ou migrations existentes.

---

## 6. APIs e rotas relevantes

- **API JSON:** `namespace :api` → `/api/v1/accounts/...`  
- **Dashboard SPA:** `/app/*` → `DashboardController` + layout `vueapp`  
- **Webhooks canais:** `config/routes.rb` (final do arquivo)  
- **Facebook Messenger (legado gem):** `mount Facebook::Messenger::Server, at: 'bot'`  
- **Meta unificado Phoenix:** `GET/POST /webhooks/meta` (extensão)  
- **Instagram nativo:** `GET/POST /webhooks/instagram`  
- **OAuth páginas FB:** `api/v1/accounts/.../callbacks#register_facebook_page`  

---

## 7. Assets e branding (pontos de customização segura)

| Asset | Caminho | Consumido por |
|-------|---------|---------------|
| Logo login/dashboard | `public/brand-assets/logo.png` | `globalConfig.logo` |
| Logo dark | `logo_dark.png` | `globalConfig.logoDark` |
| Thumbnail / favicon | `logo_thumbnail.png` | `LOGO_THUMBNAIL`, favicon link |
| Favicons PNG | `public/favicon-*.png` | `vueapp.html.erb` manifest |
| Config padrão | `config/installation_config.yml` | Super Admin, novas instalações |
| Widget “Powered by” | `app/javascript/widget/i18n/locale/{en,pt_BR}.json` | Widget embed |
| Título HTML | `app/views/layouts/vueapp.html.erb` | `INSTALLATION_NAME` |

**Script de geração:** `scripts/phoenix-generate-branding.py` → popula `branding/` e `chatwoot/public/`.

---

## 8. Pontos seguros para customização ✅

1. `public/brand-assets/*`, `public/favicon-*.png`  
2. `config/installation_config.yml` (valores default de marca)  
3. Views ERB de onboarding, super_admin login, mailers (texto/`alt` apenas)  
4. Locales widget (`POWERED_BY`, strings de marca)  
5. Novos arquivos em `app/services/phoenix/` e `app/controllers/webhooks/meta_controller.rb`  
6. Documentação em `docs/`  
7. `.env.chatwoot.example` (sem commitar segredos reais)  

---

## 9. Pontos proibidos ⛔

1. **Migrations** existentes ou schema destrutivo  
2. Renomear models (`Account`, `Inbox`, `Channel::*`, `User`)  
3. Namespaces `Chatwoot`, `ChatwootApp`, gems `chatwoot-*`  
4. Refatorar rotas `/api/v1/*` ou autenticação Devise Token Auth  
5. Remover `mount Facebook::Messenger::Server` sem plano de migração  
6. Alterar jobs core (`InstagramEventsJob`, `FacebookEventsJob`) — apenas delegar  
7. Enterprise hooks de billing sem licença  

---

## 10. Riscos

| Risco | Mitigação |
|-------|-----------|
| DB já provisionada ignora defaults do YAML | Atualizar Installation Config no Super Admin ou SQL em `installation_configs` |
| Dois endpoints Meta (`/bot`, `/webhooks/instagram`, `/webhooks/meta`) | Documentar URL única no Meta Developer; evitar duplicar subscription |
| Upgrade upstream Chatwoot sobrescreve branding | Manter patch list em `docs/rebranding-map.md`; reaplicar script de assets |
| Segredos em `.env` commitados | `.gitignore`; auditoria em `docs/security-audit.md` |
| 2127+ referências internas “Chatwoot” | Rebrand **apenas visual**; não tocar código de runtime |

---

## 11. Enterprise vs OSS

- Pasta `enterprise/` adiciona Captain (AI), recursos de billing, SLA avançado.  
- Detecção: `ChatwootApp.enterprise?` em controllers/views.  
- Customização Phoenix deve preservar esses guards.

---

*Documento gerado na Fase 1 — sem alteração de lógica de negócio além do mapeamento.*
