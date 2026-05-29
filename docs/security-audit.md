# Auditoria de Segurança — Phoenix Digital Omnichannel (Fase 9)

**Data:** 2026-05-29  
**Escopo:** Chatwoot em `chatwoot/` + variáveis em `AGENTE/.env*`

---

## 1. Secrets e variáveis sensíveis

### Presentes no repositório (exemplos — não commitar valores reais)

| Arquivo | Risco | Recomendação |
|---------|-------|--------------|
| `.env` | **Alto** se versionado | Manter no `.gitignore`; rotacionar se exposto |
| `.env.local`, `.env.vercel.production` | **Alto** | Nunca commitar; usar vault |
| `.env.chatwoot` | Médio | Apenas local/CI secret |
| `.env.example` / `.env.chatwoot.example` | Baixo | Placeholders apenas ✅ |

### Chaves críticas Chatwoot

- `SECRET_KEY_BASE` — sessões Rails  
- `FB_APP_SECRET`, `INSTAGRAM_APP_SECRET`, `META_APP_SECRET`  
- `FB_VERIFY_TOKEN`, `IG_VERIFY_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`  
- Tokens de página (`page_access_token` em DB)  
- `REDIS_PASSWORD`  

### Chaves ecossistema AGENTE (legado)

- `JWT_SECRET`, `ADMIN_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`  

---

## 2. Webhooks e assinaturas

| Endpoint | Proteção |
|----------|----------|
| `/webhooks/meta` | `hub.verify_token` + `X-Hub-Signature-256` |
| `/webhooks/instagram` | Idem (`MetaTokenVerifyConcern`) |
| `/bot` | Gem `facebook-messenger` + `ChatwootFbProvider#app_secret_for` |
| `/webhooks/whatsapp/*` | Verify challenge + assinatura |

**Boas práticas:**

- Tokens de verificação ≥ 32 caracteres aleatórios  
- Rotacionar `META_APP_SECRET` se vazamento suspeito  
- HTTPS obrigatório em produção (`FORCE_SSL=true`)  

---

## 3. CORS

Arquivo: `config/initializers/cors.rb`

- Dev / `CW_API_ONLY_SERVER`: `origins '*'` para API — **aceitável em dev**  
- Produção: definir `ENABLE_API_CORS` com origens explícitas  
- Action Cable: `disable_request_forgery_protection = true` — revisar origem no proxy  

---

## 4. CSRF

- API JSON: autenticação token (`devise_token_auth`) — sem CSRF em API  
- Dashboard HTML: `csrf_meta_tags` em `vueapp.html.erb` ✅  
- Webhooks: `ActionController::API` — sem CSRF (correto para Meta)  

---

## 5. OAuth

| Fluxo | Superfície |
|-------|------------|
| Facebook Pages | `callbacks#register_facebook_page` |
| Instagram | controllers dedicados |
| Google / Microsoft email | OAuth email channels |
| SAML | `saml_settings` por account |

**Recomendações:**

- Validar `redirect_uri` exata no Meta Developer  
- Escopos mínimos necessários  
- Reautorização automática quando token expira (mailers `facebook_disconnect`, `instagram_disconnect`)  

---

## 6. Logs e filtragem

`config/initializers/filter_parameter_logging.rb` filtra `:password`, `:secret`, `:token`, etc. ✅

Logs Phoenix (`phoenix.meta_webhook.*`) **não** incluem corpo completo do payload — apenas metadados.

---

## 7. Checklist operacional

- [ ] Confirmar `.env` fora do Git  
- [ ] `SECRET_KEY_BASE` único por ambiente  
- [ ] Firewall: Postgres/Redis não expostos publicamente  
- [ ] Rate limiting no reverse proxy (nginx/traefik)  
- [ ] Backups Postgres criptografados  
- [ ] Super Admin com senha forte + MFA se disponível  

---

## 8. Achados desta auditoria

| Severidade | Achado |
|------------|--------|
| Info | Arquivos `.env*` existem na raiz AGENTE — verificar `.gitignore` |
| Info | CORS permissivo em development por design Chatwoot |
| OK | Webhook Meta usa `secure_compare` para token e HMAC |
| OK | Parâmetros sensíveis filtrados nos logs Rails |

---

*Revisar após cada deploy ou upgrade Chatwoot.*
