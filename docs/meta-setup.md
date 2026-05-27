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

> Nesta entrega MVP, as chamadas estao como placeholders no `MetaApiService`.
