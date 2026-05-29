# Mapa de Rebranding — Phoenix Digital Omnichannel (Fase 3)

Substituição **somente visual** de “Chatwoot” por “Phoenix Digital Omnichannel”.  
Namespaces, classes Ruby, gems e rotas internas **não** foram alterados.

---

## Template Phoenix Omnichannel (2026-05-29)

| Arquivo | Função |
|---------|--------|
| `branding/phoenix-omnichannel.css` | Tema dourado (botões, fundo login) |
| `chatwoot/public/brand-assets/phoenix-omnichannel.css` | Servido pelo Chatwoot |
| `chatwoot/public/manifest.json` | PWA nome Phoenix |
| `chatwoot/app/views/layouts/vueapp.html.erb` | theme-color + CSS + meta description |
| `docker-compose.chatwoot.yml` | Monta template + CSS no container |
| `scripts/phoenix-apply-omnichannel-branding.sh` | Aplica DB + reinício |
| `scripts/phoenix-open-omnichannel.sh` | Abre `/app` |
| `docs/phoenix-omnichannel-acesso.md` | Guia de acesso único |

Inboxes `Channel::Api` renomeados como **legado**; operação em **Phoenix Omnichannel — Messenger & Instagram** (id 4).

---

## Arquivos alterados

| Arquivo | Tipo de mudança |
|---------|-----------------|
| `chatwoot/config/installation_config.yml` | `INSTALLATION_NAME`, `BRAND_NAME`, URLs de marca, paths PNG dos logos |
| `chatwoot/app/javascript/widget/i18n/locale/en.json` | `POWERED_BY` |
| `chatwoot/app/javascript/widget/i18n/locale/pt_BR.json` | `POWERED_BY` |
| `chatwoot/app/views/installation/onboarding/index.html.erb` | `<title>`, logos PNG, texto de boas-vindas, `alt` |
| `chatwoot/app/views/super_admin/devise/sessions/new.html.erb` | `<title>`, logos PNG, `alt` |
| `chatwoot/app/views/devise/mailer/confirmation_instructions.html.erb` | Fallback `brand_name` |
| `.env.chatwoot.example` | `INSTALLATION_NAME`, `BRAND_NAME`, tokens Meta |

## Assets gerados (Fase 2)

| Destino | Origem |
|---------|--------|
| `branding/logos/*`, `branding/favicons/*`, etc. | `scripts/phoenix-generate-branding.py` |
| `chatwoot/public/brand-assets/logo.png` | Logomarca Phoenix |
| `chatwoot/public/brand-assets/logo_dark.png` | Idem |
| `chatwoot/public/brand-assets/logo_thumbnail.png` | Idem |
| `chatwoot/public/favicon-*.png` | Derivados 16–512px |

## Código novo (extensão, não rebrand)

| Arquivo | Motivo |
|---------|--------|
| `chatwoot/config/routes.rb` | Rotas `webhooks/meta` |
| `chatwoot/app/controllers/webhooks/meta_controller.rb` | Gateway Meta Phoenix |
| `chatwoot/app/services/phoenix/meta_webhook_*.rb` | Normalização e logs |

---

## Preservado intencionalmente

- Classes: `ChatwootApp`, `ChatwootHub`, `ChatwootMarkdownRenderer`, `ChatwootFbProvider`  
- Gem `facebook-messenger`, rota `/bot`  
- ~2000+ strings i18n de integrações que citam “Chatwoot” em descrições técnicas  
- `package.json` name `@chatwoot/chatwoot`  
- Locales `config/locales/en.yml` (descrições de apps Dyte, Slack, etc.)  

---

## Pós-deploy: instalação já existente

Se a instância já estiver rodando, atualizar via **Super Admin → Installation Config** ou:

- `INSTALLATION_NAME` → Phoenix Digital Omnichannel  
- `BRAND_NAME` → Phoenix Digital Omnichannel  
- `LOGO` → `/brand-assets/logo.png`  
- `LOGO_DARK` → `/brand-assets/logo_dark.png`  
- `LOGO_THUMBNAIL` → `/brand-assets/logo_thumbnail.png`  

---

*Última atualização: 2026-05-29*
