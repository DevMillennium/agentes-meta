# Phoenix Digital Omnichannel — Acesso único

**Não use** o painel antigo `phoenix-marketing-web` (Vercel).  
**Use apenas** o Chatwoot rebrandizado.

## URL do painel

| Ambiente | URL |
|----------|-----|
| Local | http://localhost:3001/app |
| Tunnel (dev) | Ver `PHOENIX_OMNICHANNEL_URL` em `.env.chatwoot` |
| Produção | `https://seu-dominio-chatwoot.com/app` |

Abrir rapidamente:

```bash
./scripts/phoenix-open-omnichannel.sh
```

## Meta (Messenger + Instagram + WhatsApp)

OAuth e botões de conexão ficam **no Chatwoot** (não no painel Vercel antigo).

Guia completo: **[phoenix-conectar-canais.md](./phoenix-conectar-canais.md)**

Resumo:

1. **Configurações** → **Caixas de Entrada** → **Adicionar caixa de entrada**
2. **Messenger** → logo Facebook (OAuth Meta)
3. **Instagram** → **Continuar com o Instagram**
4. **WhatsApp** → Cloud API / Embedded Signup

Atalho: `./phoenix connect facebook` | `instagram` | `whatsapp`

## Ativar operação (menu limpo + Meta)

```bash
./phoenix activate
```

Remove inboxes `Channel::Api` da stack antiga (simulados) e deixa só **Phoenix Omnichannel — Messenger & Instagram**.

## OAuth Meta (servidor)

Apenas para renovar token na API Phoenix (Neon), se necessário:

```bash
./scripts/phoenix-meta-oauth-url.sh
```

Operação diária = **Chatwoot** `/app`.

## Scripts

| Script | Função |
|--------|--------|
| `phoenix-apply-omnichannel-branding.sh` | Logos + DB + CSS + reinício |
| `phoenix-meta-full-auto.sh` | Webhooks + Chatwoot Meta |
| `phoenix-tunnel-chatwoot.sh` | Tunnel HTTPS + webhooks |
| `phoenix-open-omnichannel.sh` | Abre o painel no browser |
