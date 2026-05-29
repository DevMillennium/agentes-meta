# Conectar Facebook, Instagram e WhatsApp (OAuth no painel)

O **Phoenix Digital Omnichannel** usa o fluxo **nativo do Chatwoot**. O usuário **não** vincula canais no painel antigo da Vercel (`/configuracoes/meta`).

## Onde fica o OAuth (botões)

| Canal | Caminho no painel | Botão / ação |
|--------|-------------------|--------------|
| **Facebook + Messenger** (e IG ligado à página) | Configurações → Caixas de Entrada → **Adicionar** → **Messenger** | Logo **Facebook** → popup `FB.login` (Meta OAuth) |
| **Instagram** (DM direto no perfil) | Configurações → Caixas de Entrada → **Adicionar** → **Instagram** | **Continuar com o Instagram** → redirect OAuth Meta |
| **WhatsApp** | Configurações → Caixas de Entrada → **Adicionar** → **WhatsApp** | Embedded Signup Meta **ou** formulário manual (Cloud API) |

### URLs diretas (conta `1`)

Substitua o host pelo seu (`PHOENIX_OMNICHANNEL_URL` ou `localhost:3001`):

| Ação | URL |
|------|-----|
| Lista de caixas | `/app/accounts/1/settings/inboxes/list` |
| Escolher canal | `/app/accounts/1/settings/inboxes/new` |
| OAuth Facebook | `/app/accounts/1/settings/inboxes/new/facebook` |
| OAuth Instagram | `/app/accounts/1/settings/inboxes/new/instagram` |
| OAuth WhatsApp | `/app/accounts/1/settings/inboxes/new/whatsapp` |
| Inbox já criado (reconectar) | `/app/accounts/1/settings/inboxes/4` |

Abrir no terminal:

```bash
./phoenix connect
```

## Passo a passo (usuário final)

### 1. Entrar como administrador

Login em `/app/login` (conta com perfil **Administrador**).

### 2. Abrir gestão de caixas

1. Ícone **Configurações** (engrenagem) na barra lateral  
2. **Caixas de Entrada**  
3. Botão **Adicionar caixa de entrada** (canto superior)

### 3. Facebook / Messenger (+ Instagram da página)

1. Escolha **Messenger** (ícone Facebook)  
2. Clique no **logo do Facebook** → login Meta  
3. Autorize o app **Phoenix Marketing Automat**  
4. Selecione a **Página** (ex.: Phoenix Global Import)  
5. Nome da caixa → **Criar caixa de entrada**  
6. Adicione agentes → Concluir  

> Uma caixa `Channel::FacebookPage` atende **Messenger** e, se a página tiver IG vinculado, **Instagram DM** pela mesma integração.

### 4. Instagram (canal separado, se necessário)

1. **Adicionar** → **Instagram**  
2. **Continuar com o Instagram**  
3. Login Meta e permissões `instagram_manage_messages`  

Use só se precisar do fluxo Instagram **sem** passar pela página Facebook.

### 5. WhatsApp

1. **Adicionar** → **WhatsApp**  
2. Escolha **WhatsApp Cloud** (recomendado)  
3. Siga o **Embedded Signup** da Meta (número + Business Account)  

Requisitos no app Meta: produto WhatsApp, `WHATSAPP_APP_ID` e `WHATSAPP_CONFIGURATION_ID` no servidor (super admin / `InstallationConfig`).

### 6. Reconectar canal existente

Se aparecer *“caixa desconectada”*:

1. Configurações → Caixas de Entrada → clique na caixa  
2. Banner amarelo → **Clique aqui para reconectar**  
3. Mesmo OAuth (Facebook / Instagram / WhatsApp)

## OAuth `./phoenix oauth` (não é para o usuário do painel)

```bash
./phoenix oauth
```

Serve para renovar token na **API Phoenix (Neon/Vercel)** usada pelos scripts (`phoenix meta`).  
**Não** substitui o login Facebook/Instagram dentro do Chatwoot.

| Quem | Onde autentica |
|------|----------------|
| Agente no painel | Chatwoot → Adicionar caixa / Reconectar |
| Scripts / servidor | `./phoenix oauth` (opcional) |

## Pré-requisitos técnicos (já feitos pelos scripts)

- `FB_APP_ID` / `FB_APP_SECRET` em `InstallationConfig` (`./phoenix meta`)  
- Webhook: `{FRONTEND_URL}/webhooks/meta`  
- Tunnel HTTPS em dev: `./phoenix tunnel`  

## Inbox omnichannel atual

Após `./phoenix activate`, a operação diária usa:

**Phoenix Omnichannel — Messenger & Instagram** (id `4`)

Novos canais entram pelo fluxo **Adicionar caixa de entrada** acima; o menu **Canais** na sidebar lista cada inbox conectado.
