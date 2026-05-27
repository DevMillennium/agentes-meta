# Deploy na Vercel (Web + API + multi-usuário)

Dois projetos Vercel no mesmo repositório Git:

| Projeto | Root Directory | URL típica |
|---------|----------------|------------|
| **phoenix-marketing-web** | `apps/web` | https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app |
| **phoenix-marketing-api** | `.` (raiz) | https://phoenix-marketing-api-millenniumomnichannel-4893s-projects.vercel.app |

Repositório Git: https://github.com/DevMillennium/agentes-meta

## 1. Banco de dados (obrigatório)

Crie Postgres gerenciado (Vercel Postgres, Neon ou Supabase) e use a connection string em **ambos** os projetos:

```env
DATABASE_URL=postgresql://...
```

Após o primeiro deploy da API, rode migração uma vez (local ou CI):

```bash
npx prisma db push
```

## 2. Variáveis — projeto **phoenix-api**

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Postgres |
| `JWT_SECRET` | Sim | ≥ 16 caracteres |
| `JWT_EXPIRES_IN` | Não | Ex.: `12h` |
| `ADMIN_API_KEY` | Sim | Chave máquina-a-máquina (≥ 16 chars) |
| `ADMIN_EMAIL` | Sim | E-mail do admin inicial (se DB vazio) |
| `ADMIN_PASSWORD` | Sim | Senha do admin inicial (se DB vazio) |
| `USERS_BOOTSTRAP` | Não | JSON com vários usuários (ver abaixo) |
| `OPENAI_API_KEY` | Sim | Agentes IA |
| `META_APP_ID` | Sim | App Meta |
| `META_APP_SECRET` | Sim | Secret do app |
| `META_REDIRECT_URI` | Sim | `https://SEU-API.vercel.app/api/meta/oauth/callback` |
| `META_WEBHOOK_VERIFY_TOKEN` | Sim | Token de verificação webhooks |
| `META_API_VERSION` | Não | `v25.0` |
| `API_PUBLIC_URL` | Sim | `https://SEU-API.vercel.app` |
| `WEB_APP_URL` | Sim | `https://SEU-WEB.vercel.app` |
| `API_CORS_ORIGIN` | Sim | `https://SEU-WEB.vercel.app` (pode listar várias URLs separadas por vírgula) |
| `ENABLE_WORKERS` | Não | `false` na Vercel (sem Redis) |
| `REDIS_URL` | Não | Só se `ENABLE_WORKERS=true` |
| `META_ACCESS_TOKEN` | Não | Fallback global; cada usuário usa OAuth próprio |

### Vários usuários (`USERS_BOOTSTRAP`)

```json
[
  {
    "email": "admin@empresa.com",
    "password": "SenhaForteAdmin123",
    "name": "Admin",
    "role": "admin"
  },
  {
    "email": "maria@empresa.com",
    "password": "SenhaForteMaria123",
    "name": "Maria",
    "role": "operator"
  }
]
```

Cole como **uma linha** no painel Vercel (variável `USERS_BOOTSTRAP`).

Cada usuário faz login no web, conecta **sua** conta Meta em Configurações → Integração Meta. Tokens ficam em `UserMetaConnection` no Postgres.

Admin pode criar mais usuários: `POST /api/auth/users` (Bearer admin).

## 3. Variáveis — projeto **phoenix-web**

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_API_URL` | Sim | `https://SEU-API.vercel.app` |
| `NEXT_PUBLIC_META_APP_ID` | Sim | Mesmo `META_APP_ID` |
| `NEXT_PUBLIC_META_API_VERSION` | Não | `v25.0` |
| `NEXT_PUBLIC_ADMIN_API_KEY` | Não | Opcional; prefira login JWT |

## 4. Meta Developer Console

1. **Redirect URI:** `https://SEU-API.vercel.app/api/meta/oauth/callback`
2. **Domínios do app:** `seu-app.vercel.app`
3. **Webhooks:** `https://SEU-API.vercel.app/webhooks/whatsapp` e `/webhooks/instagram`

## 5. Deploy via CLI

```bash
# API
cd apps/api && vercel --prod

# Web (defina NEXT_PUBLIC_API_URL antes)
cd apps/web && vercel --prod
```

## 6. Fluxo multi-usuário

1. Usuário acessa `/login` no web.
2. Autentica com e-mail/senha (JWT em `localStorage`).
3. Em `/configuracoes/meta`, conecta Facebook → token salvo **só para esse usuário**.
4. Agentes e campanhas usam o token do usuário logado.
