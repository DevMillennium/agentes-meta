# Checklist Omnichannel — Phoenix Digital Omnichannel (Fase 6)

Legenda: **FUNCIONANDO** | **PARCIAL** | **NÃO CONFIGURADO**

Estado baseado na auditoria do código Chatwoot 4.14.1 e configuração local observada.

---

## Canais principais (missão Meta)

| Canal | Código / rota | Status | Observações |
|-------|---------------|--------|-------------|
| **Facebook Messenger** | `Channel::FacebookPage`, `/bot`, `/webhooks/meta` | **PARCIAL** | Requer `FB_APP_ID`, página conectada, token válido; webhook em `/bot` ou Phoenix `/webhooks/meta` |
| **Instagram DM** | `Channel::Instagram`, `/webhooks/instagram` | **PARCIAL** | `InstagramEventsJob`; IG_VERIFY_TOKEN ou INSTAGRAM_VERIFY_TOKEN |
| **Web Chat (Widget)** | `Channel::WebWidget` | **FUNCIONANDO** | Core Chatwoot; branding Phoenix no widget (`POWERED_BY`, logos via config) |
| **Email** | `Channel::Email` | **PARCIAL** | Requer SMTP/IMAP ou Microsoft/Google OAuth configurados |

---

## Canais adicionais disponíveis (preservados)

| Canal | Status típico | Notas |
|-------|---------------|-------|
| WhatsApp Cloud | **NÃO CONFIGURADO** | `/webhooks/whatsapp/:phone`, credenciais Meta WhatsApp |
| Telegram | **NÃO CONFIGURADO** | Bot token |
| Line | **NÃO CONFIGURADO** | Channel ID |
| SMS (Twilio) | **NÃO CONFIGURADO** | Credenciais Twilio |
| Twitter/X | **NÃO CONFIGURADO** | CRC + events |
| TikTok | **NÃO CONFIGURADO** | `/webhooks/tiktok` |
| API Channel | **NÃO CONFIGURADO** | Para integrações custom |

---

## Infraestrutura

| Componente | Status | Verificação |
|------------|--------|-------------|
| PostgreSQL | **FUNCIONANDO** | `docker-compose` serviço `postgres` |
| Redis / Sidekiq | **FUNCIONANDO** | Worker `sidekiq` no compose |
| Rails + Vite | **FUNCIONANDO** | Portas 3000 / 3036 |
| Mailhog (dev) | **FUNCIONANDO** | Email em desenvolvimento |

---

## Branding Phoenix

| Item | Status |
|------|--------|
| Logos `brand-assets/*.png` | **FUNCIONANDO** |
| Favicons | **FUNCIONANDO** |
| INSTALLATION_NAME default | **FUNCIONANDO** (YAML; DB pode precisar sync) |
| Widget powered-by PT/EN | **FUNCIONANDO** |

---

## Webhook Meta unificado

| Item | Status |
|------|--------|
| `GET /webhooks/meta` (verify) | **FUNCIONANDO** (código) |
| `POST /webhooks/meta` (events) | **FUNCIONANDO** (código) |
| Subscription no Meta Developer | **NÃO CONFIGURADO** (operacional) |
| Logs estruturados JSON | **FUNCIONANDO** |

---

## Testes recomendados pós-configuração

- [ ] Enviar mensagem teste pelo Widget  
- [ ] Conectar página Facebook e receber DM Messenger  
- [ ] Conectar Instagram Business e receber DM  
- [ ] Enviar email para inbox e ver thread  
- [ ] Verificar logs `phoenix.meta_webhook.received` no Rails  

---

*Atualizar status operacional após go-live em produção.*
