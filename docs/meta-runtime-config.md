# Meta — Configuração aplicada (2026-05-29)

## App Meta

| Campo | Valor |
|-------|--------|
| App ID | `27447238071580159` |
| Nome | Phoenix Marketing Automat |
| Verify Token | `phoenix-verify-token` (Chatwoot + `/webhooks/meta`) |

## Via Graph API (concluído)

### Webhooks ativos

| Objeto | Callback | Status |
|--------|----------|--------|
| `page` (Messenger) | `https://adam-transmitted-glasgow-rent.trycloudflare.com/webhooks/meta` | **active** |
| `instagram` | `https://adam-transmitted-glasgow-rent.trycloudflare.com/webhooks/meta` | **active** |

Campos inscritos conforme requisitos Chatwoot (messages, postbacks, deliveries, reads, echoes, standby, etc.).

### Domínios do app

- `phoenix-marketing-api.vercel.app`
- `phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app`
- `localhost`
- `adam-transmitted-glasgow-rent.trycloudflare.com`

### Chatwoot (InstallationConfig)

Definidos no Postgres da instância:

- `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, `IG_VERIFY_TOKEN`, `INSTAGRAM_VERIFY_TOKEN`
- `FACEBOOK_API_VERSION` / `INSTAGRAM_API_VERSION` = `v25.0`

## Tunnel público (desenvolvimento)

- **Cloudflare Quick Tunnel:** `https://adam-transmitted-glasgow-rent.trycloudflare.com` → `localhost:3001`
- Processo: `cloudflared tunnel --url http://localhost:3001`
- **Atenção:** URL muda a cada execução do quick tunnel; reexecute `scripts/phoenix-meta-configure.sh` após novo tunnel.

## Automação executada (2026-05-29)

| Item | Status |
|------|--------|
| Inbox `Channel::FacebookPage` (id **4**) — Phoenix Global Import | OK |
| `instagram_id` na página `17841405786843323` | OK |
| Agente admin no inbox 4 | OK |
| Webhooks `page` + `instagram` → `/webhooks/meta` | OK (active) |
| Domínios do app + tunnel Cloudflare | OK |
| InstallationConfig Chatwoot | OK |
| `CHATWOOT_INBOX_ID_FACEBOOK=4` no `.env` | OK |
| Script idempotente | `scripts/phoenix-meta-full-auto.sh` |

### OAuth concluído (2026-05-29 21:09 UTC)

- Token salvo no Neon para `admin@phoenixglobal.com.br`
- Escopo **`pages_messaging`** ativo
- `POST /{page-id}/subscribed_apps` → **success**
- Chatwoot inbox **4** (Phoenix Global Import) + webhooks ativos

No painel web: **atualize a página** (F5) estando logado — `Token no servidor` deve aparecer como **Sim**.

### Escopo `pages_messaging` (resolvido)

O token Neon atual **não** inclui `pages_messaging` (necessário para `subscribed_apps` na página). Use **sempre** a URL gerada pela API (state JWT válido). Não use links com `state=phoenix-auto-...`:

```bash
./scripts/phoenix-meta-oauth-url.sh
```

Erro `Código ou state OAuth inválido/expirado` = state inválido ou expirado (>10 min).

Após autorizar no navegador, rode novamente:

```bash
./scripts/phoenix-meta-full-auto.sh
```

## Pendente no painel Meta (sem API pública)

Abrir (já lançado no navegador):

1. [Facebook Login → Settings](https://developers.facebook.com/apps/27447238071580159/fb-login/settings/)  
   Adicionar em **Valid OAuth Redirect URIs**:
   - `https://adam-transmitted-glasgow-rent.trycloudflare.com/`
   - `http://localhost:3001/`
   - `https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback`

2. Conectar **Página** e **Instagram** no Chatwoot:  
   `https://adam-transmitted-glasgow-rent.trycloudflare.com/app` → Settings → Inboxes → Facebook/Instagram

3. **Produção:** substituir tunnel por domínio fixo (ex. `https://chatwoot.seudominio.com`) e rodar:

```bash
export PHOENIX_CHATWOOT_PUBLIC_URL=https://chatwoot.seudominio.com
./scripts/phoenix-meta-configure.sh
```

## Marketing API

- Conta conhecida: `act_35275039595476018`
- Requer token de usuário/sistema com `ads_management` — configurar após OAuth no painel ou API Phoenix.

## Comandos úteis

```bash
# Listar webhooks
curl "https://graph.facebook.com/v25.0/27447238071580159/subscriptions?access_token=APP_ID|APP_SECRET"

# Testar verify
curl "https://SEU_DOMINIO/webhooks/meta?hub.mode=subscribe&hub.verify_token=phoenix-verify-token&hub.challenge=test"
```
