# Phoenix Digital Omnichannel — Landing estilo Chatrace (SaaS)

Objetivo: página inicial e fluxo “Criar conta / Conectar canal” no formato Chatrace, **sem alterar** a lógica do Chatwoot (`/app`, OAuth Meta, inboxes, webhooks).

---

## Princípio (zero retrocesso)

| Camada | O que é | Regra |
|--------|---------|--------|
| **Pública Phoenix** | HTML/ERB + CSS em `/`, `/comecar` | Nova; só links e layout |
| **Auth Chatwoot** | `/app/login`, `/app/auth/signup` | Já customizado (login premium) |
| **App Chatwoot** | `/app/*` | Intocado; mesmos controllers/jobs |

Não forkar o bundle Vue do dashboard. Não substituir `ChannelList.vue` — **redirecionar** para as rotas que já existem.

---

## Mapa Chatrace → Phoenix

| Tela Chatrace | Phoenix (proposta) | Backend real |
|---------------|-------------------|--------------|
| Home marketing | `GET /` | Estático/ERB |
| “Iniciar teste grátis” | `GET /comecar` ou `/app/auth/signup` | `ENABLE_ACCOUNT_SIGNUP` |
| “Conectar-se” | `GET /app/login` | Devise token auth |
| Lista “Criar nova conta” + Continuar | `GET /comecar/canais` | Cards → deep link pós-login |
| Continuar → Messenger | `/app/accounts/:id/settings/inboxes/new/facebook` | `FB.login` |
| Continuar → Instagram | `.../new/instagram` | Instagram Business Login |
| Continuar → WhatsApp | `.../new/whatsapp` | Embedded Signup / Cloud API |
| App logado | `/app` | Inalterado |

---

## Arquitetura de rotas

```mermaid
flowchart TD
  A[Visitante GET /] --> B{Já logado?}
  B -->|sim| C[/app]
  B -->|não| D[Landing Phoenix]
  D --> E[Teste grátis /comecar]
  D --> F[Login /app/login]
  D --> G[Conectar canais /comecar/canais]
  E --> H[Signup /app/auth/signup]
  F --> I[Dashboard /app]
  G --> J{Autenticado?}
  J -->|não| K[Login com return_to=canal]
  J -->|sim| L[OAuth canal nativo Chatwoot]
  K --> L
  L --> M[Inbox criada /app]
```

Rotas novas (exemplo):

```ruby
# config/routes.rb (trecho Phoenix)
root to: 'phoenix/welcome#home'
get '/comecar', to: 'phoenix/welcome#start'
get '/comecar/canais', to: 'phoenix/welcome#channels'
# /app e /app/* permanecem dashboard#index
```

---

## Fluxos de usuário

### 1. Visitante (marketing)

- Hero: “Agentes de IA para suporte, vendas e marketing” (copy Phoenix).
- CTA primário: **Iniciar teste grátis** → signup (se habilitado) ou `/comecar`.
- CTA secundário: **Conectar-se** → `/app/login`.
- Faixa de ícones: Messenger, Instagram, WhatsApp (e-mail/web conforme roadmap).
- Visual: logo `logo_login.png`, dourado `#c9a227`, fundo escuro/claro alinhado ao login premium.

### 2. Teste grátis (multi-tenant)

No Chatwoot:

- `InstallationConfig` → `ENABLE_ACCOUNT_SIGNUP=true` (instâncias SaaS).
- Opcional: `CREATE_NEW_ACCOUNT_FROM_DASHBOARD` para convite controlado em enterprise.

Fluxo: signup → confirmação e-mail → primeiro login → **wizard** `/comecar/canais` (não cair direto no inbox vazio).

### 3. Conectar canal (formato Chatrace)

Página `/comecar/canais`: cards verticais (Messenger, Instagram, WhatsApp, …) com botão **Continuar**.

Cada **Continuar**:

1. Se não autenticado → `/app/login?return_to=/comecar/canais?canal=instagram`
2. Se autenticado → redirect para deep link Chatwoot:

| Canal | Deep link |
|-------|-----------|
| messenger / facebook | `/app/accounts/:accountId/settings/inboxes/new/facebook` |
| instagram | `.../new/instagram` |
| whatsapp | `.../new/whatsapp` |
| website | `.../new/website` |

`:accountId` = conta do usuário logado (helper no controller Phoenix).

### 4. OAuth “direto” da landing

Na home, ícones podem linkar para `/comecar/canais?canal=instagram` (mesmo fluxo). **Não** duplicar OAuth na landing — sempre delegar ao Chatwoot após auth.

---

## Identidade Phoenix (sem parecer Chatrace)

| Elemento | Chatrace | Phoenix |
|----------|----------|---------|
| Cor primária | Azul/rosa gradiente | Dourado `#c9a227`, `#e8d48b` |
| Logo | Foguete azul | `logo_login.png` / Phoenix Omnichannel |
| Tipografia | Sans genérica | Cormorant + Inter (já no login) |
| Tom | “Teste grátis” genérico | “Omnichannel · Building Global Opportunities” |

Reutilizar `phoenix-omnichannel.css` + variáveis `:root` já definidas.

---

## Implementação técnica (fases)

### Fase 1 — Sem build Vue (recomendada)

- `app/controllers/phoenix/welcome_controller.rb`
- Views ERB: `home`, `start`, `channels`
- Assets: `public/brand-assets/phoenix-landing.css`
- Montar no `docker-compose.chatwoot.yml` (como `meta_controller`)
- `root` aponta para `welcome#home`; quem acessa `/app` continua igual

**Risco:** baixo. **Retrocesso:** nenhum se `/app` não mudar.

### Fase 2 — Pós-login

- Middleware ou hook: primeiro login → redirect `/comecar/canais` uma vez (flag em `account_users` ou cookie).
- Banner no `/app` se zero inboxes: “Conecte seu primeiro canal”.

### Fase 3 — SaaS por cliente

- Uma instalação Docker = um cliente (white-label via `InstallationConfig`).
- Ou super-admin + subdomínios (`custom_domain` portal pattern já existe no Chatwoot).
- Trial: campo `account.custom_attributes['trial_ends_at']` + job (futuro).

### Fase 4 — Opcional

- Página de preços `/precos` (estática).
- Integração billing (Stripe) fora do Chatwoot core.

---

## O que não fazer

1. **Não** colocar vários Instagram na mesma inbox `FacebookPage` — modelo Chatwoot não suporta.
2. **Não** usar `FB_APP_ID` no fluxo Instagram Login — usar **Instagram App ID** do produto Meta correto.
3. **Não** remover `/app/login` nem alterar jobs/webhooks.
4. **Não** recompilar frontend só para landing — ERB é suficiente.

---

## Checklist antes de go-live SaaS

- [ ] `ENABLE_ACCOUNT_SIGNUP` definido por ambiente
- [ ] `FRONTEND_URL` estável (domínio fixo, não só tunnel)
- [ ] Redirect URIs Meta para login + Instagram + WhatsApp
- [ ] `INSTAGRAM_APP_ID` = ID do produto Instagram Login (≠ só FB App ID)
- [ ] Landing + login + `/app` testados em mobile
- [ ] Documentar para revendedor: `docs/phoenix-conectar-canais.md`

---

## Comandos úteis (após Fase 1)

```bash
./phoenix open                    # /app
open http://localhost:3001/       # landing (futuro)
open http://localhost:3001/comecar/canais
./phoenix connect instagram
```
