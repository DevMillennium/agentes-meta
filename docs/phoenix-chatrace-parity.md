# Chatrace → Phoenix Digital Omnichannel — paridade de produto

Referência: [Chatrace Knowledge Base](https://docs.chatrace.com/)

Este documento mapeia **cada seção** da documentação Chatrace para o que o Phoenix (Chatwoot + extensões) **já oferece**, **oferece parcialmente** ou **planeja** — sem fork do builder visual do Chatwoot.

---

## Legenda

| Status | Significado |
|--------|-------------|
| ✅ | Usável hoje no Phoenix |
| 🟡 | Parcial / equivalente diferente |
| 🔧 | Via integração (Make, Zapier, API, script) |
| 📋 | Roadmap documentado (P3+) |
| ❌ | Fora do escopo do core Chatwoot |

---

## 1. Ads (2 artigos)

| Artigo Chatrace | Phoenix | Status |
|-----------------|---------|--------|
| Send conversion events to Facebook | `phoenix-marketing-api` + Graph API | 🔧 |
| Facebook Lead Ads Automation | Webhook → contato/conversa Chatwoot | 🔧 |

---

## 2. Drip Campaign (1 artigo)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Drip Campaigns | Campanhas Chatwoot + automação futura | 🟡 / 📋 |

---

## 3. Whitelabel (14 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Marca, ícone, cores, rename, help | `InstallationConfig`, logos, landing, login premium | ✅ |
| Itens no ícone de ajuda | `dashboard_apps` / links landing | 🟡 |

---

## 4. AI (19 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| AI agent nas mensagens | **Captain** (ex.: Fernanda) | ✅ |
| Arquivos no agente | Captain Documents | ✅ |
| OpenAI ChatGPT | Integrações + `CAPTAIN_OPEN_AI_API_KEY` | ✅ |
| Gemini / Claude | `docs/ai-architecture.md` | 📋 |
| Copilot humano | Captain copilot / reply suggestion | ✅ |

Doc: [phoenix-captain-assistente.md](./phoenix-captain-assistente.md)

---

## 5. Pipeline (1 artigo)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Pipeline de vendas | Labels + status; sem kanban nativo | 🟡 |

---

## 6. Inbox (12 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Flow da inbox | Macros + Captain | 🟡 |
| WhatsApp Template | Inbox WA (após conectar) | 🟡 |
| Saved replies | Canned responses | ✅ |
| Block / archive | Contatos / conversas | ✅ |
| Inbox unificado | Core Chatwoot | ✅ |

---

## 7. Messenger (13 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Welcome Message | Captain `welcome_message` / greeting | ✅ |
| Core Messenger bot | `Channel::FacebookPage` + OAuth | ✅ |
| Auto-reply comentários FB/IG | Ver **P3** abaixo | 📋 |
| Marketing Messages | Graph API + campanhas | 🔧 |
| Conversation starters | Meta Developer + greeting | 🟡 |

---

## 8. WhatsApp (7 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| WA Whitelabel / broadcast / commerce | Embedded Signup Chatwoot | 🟡 → **P1** `./phoenix p1` |

---

## 9. Instagram (8 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Instagram Automation (DM) | Via página FB ou inbox `Instagram` | ✅ / 🟡 |
| Story / comment / mention bots | **P3** | 📋 |
| Conversation starters | Meta + greeting | 🟡 |

**P1:** `INSTAGRAM_APP_ID` dedicado (≠ `FB_APP_ID`) — `scripts/phoenix-p1-channels.sh`

---

## 10. Telegram (4 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Bot, broadcast, localização | `Channel::Telegram` | ✅ (conectar no painel) |

---

## 11. Viber (3 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Viber | Sem canal nativo | ❌ |

---

## 12. SMS (2 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Twilio SMS | `Channel::TwilioSms` | ✅ |

---

## 13. Voice (2 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Twilio / AudioCodes voice | Sem inbox de voz | ❌ |

---

## 14. Settings (1 artigo)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Nome / avatar da conta | Settings Chatwoot | ✅ |

---

## 15. Tools (6 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Appointment scheduling | Calendly + webhook | 🔧 |
| Bot Simulator | Captain Playground + `./phoenix e2e` | ✅ |
| Places / QR / Poll | Scripts / externos | 🔧 / ❌ |

---

## 16. Integration (19 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| OpenAI | Integrações + Captain | ✅ |
| Dialogflow | Agent Bot webhook | 🔧 |
| Make / Zapier | Webhooks + API | ✅ → **P2** `/comecar/integracoes` |
| Google Sheets / Stripe | Make/Zapier ou EE Stripe | 🔧 / 🟡 |

---

## 17. Tips & Tricks (4 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Tamanho de arquivo | Limites Meta/Chatwoot | 📋 |
| Copiar flow | N/A | ❌ |
| Social login | OAuth Chatwoot | 🟡 |
| Bot só admins | Inbox / modo teste | 🟡 |

---

## 18. Flows (6 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Flow builder visual | Não replicar no Vue Chatwoot | ❌ |
| Custom fields | Custom attributes | ✅ |
| Get started | `/`, `/comecar` | ✅ |
| Localização | Mensagens + anexos | 🟡 |

**Decisão:** Captain + Automation Rules + Macros em vez de flows visuais.

---

## 19. Grow (3 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| QR / entry links | Landing + UTM | 🟡 |
| Omnichannel link | `/comecar/canais` | ✅ |

---

## 20. Analytics (3 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Sem resposta / sales / new users | Relatórios Chatwoot | 🟡 |

---

## 21. Ecommerce (9 artigos)

| Chatrace | Phoenix | Status |
|----------|---------|--------|
| Checkout, shipping, payment | Loja externa + links | ❌ / 🔧 WA Commerce |

---

## P1 — Canais prioritários (implementado via script)

| Item | Comando / URL |
|------|----------------|
| WhatsApp Cloud | `./phoenix connect whatsapp` |
| Instagram App ID | `INSTAGRAM_APP_ID` em `.env` → `./phoenix p1` |
| Widget no site | `/comecar/widget` + `chatwoot/public/brand-assets/phoenix-widget-snippet.html` |

---

## P2 — Página Integrações (landing)

URL: **`/comecar/integracoes`**

Espelha a seção [Integration](https://docs.chatrace.com/) do Chatrace: OpenAI, Make, Zapier, Dialogflow, webhooks, Meta.

---

## P3 — Auto-reply comentários FB/IG (roadmap)

**Não implementado no core** — requisito de negócio separado do DM.

| Recurso Chatrace | Abordagem Phoenix futura |
|------------------|-------------------------|
| Auto-reply comentários em posts | Webhook Meta `feed` + job `Phoenix::CommentReplyJob` |
| Auto-reply story replies | Webhook `instagram` story |
| Story mention | Webhook `mentions` |

Pré-requisitos: permissões `pages_manage_engagement`, `instagram_manage_comments`, app review Meta.

Enquanto isso: DM + Captain cobrem atendimento em Messenger/Instagram inbox.

---

## Prioridades executivas

| Fase | Itens |
|------|--------|
| **P0** | AI, Inbox, Messenger, Grow, Whitelabel ✅ |
| **P1** | WhatsApp, Instagram ID, widget embed ✅ scripts |
| **P2** | Landing integrações ✅ |
| **P3** | Comentários/stories IG/FB 📋 |

---

## Comandos

```bash
./phoenix go-live
./phoenix p1
./phoenix verify
open http://localhost:3001/comecar/integracoes
open http://localhost:3001/comecar/widget
```
