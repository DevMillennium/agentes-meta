# Meta Setup (Fase 2)

1. Criar aplicativo no Meta for Developers.
2. Habilitar produtos: Marketing API, Instagram Graph/Messaging e WhatsApp Cloud API.
3. Configurar OAuth e `redirect_uri`.
4. Solicitar permissoes de producao:
   - `ads_management`
   - `ads_read`
   - `business_management`
   - permissoes de Instagram e WhatsApp necessarias para mensagens.
5. Registrar webhooks publicos HTTPS para:
   - `/webhooks/instagram`
   - `/webhooks/whatsapp`

## Envio real de mensagens (Graph API)

Quando as variaveis abaixo estiverem definidas, a API usa chamadas reais (com retry e timeout configuraveis):

- `META_ACCESS_TOKEN` — token de acesso (ex.: Page token com permissoes de WhatsApp/Instagram).
- `WHATSAPP_PHONE_NUMBER_ID` — ID do numero no Cloud API (envio: `POST /{phone-number-id}/messages`).
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` — ID da conta comercial do Instagram (envio: `POST /{ig-user-id}/messages`).

Opcionais:

- `META_HTTP_TIMEOUT_MS` — timeout HTTP em ms (padrao `15000`).
- `META_HTTP_RETRIES` — tentativas adicionais em erro rede/5xx/429 (padrao `2`).

Sem `META_ACCESS_TOKEN` + IDs acima, o sistema permanece em modo **placeholder** (nao chama a Meta) para desenvolvimento seguro.

## Status de entrega (WhatsApp)

Webhooks que incluem `statuses` (sent, delivered, read, failed) sao parseados e gravados em `agent_actions` com `actionType: message_delivery_status`.

Documentacao oficial:

- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Instagram Messaging](https://developers.facebook.com/docs/instagram-platform/instagram-messaging)
- [Marketing API](https://developers.facebook.com/docs/marketing-apis)

> Integracao Marketing API / Ads Insights para criacao de campanhas continua como placeholder ate a proxima fase.
