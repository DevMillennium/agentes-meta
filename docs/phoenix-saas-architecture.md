# Arquitetura Multiempresa — Phoenix SaaS (Fase 7)

**Escopo:** documentação apenas — **sem implementação** nesta fase.

---

## 1. Modelo conceitual

```
Company (tenant legal / faturamento)
 └── Workspace (ambiente operacional = Account Chatwoot)
      ├── Channel (Inbox / Channel::*)
      ├── Agent (User + AccountUser + role)
      └── AI Agent (Captain Assistant / AgentBot / integração externa)
```

### Mapeamento para Chatwoot existente

| Conceito Phoenix | Entidade Chatwoot atual |
|------------------|------------------------|
| Workspace | `Account` |
| Channel | `Inbox` + `Channel::*` |
| Agent | `User` + `AccountUser` |
| AI Agent | `Captain::Assistant`, `AgentBot`, webhooks LLM |

**Company** não existe como first-class citizen — hoje multi-tenant é por `Account` isolado.

---

## 2. Estratégia de evolução (sem quebrar core)

### Fase A — Lógica (futuro)

1. Tabela `companies` com `id`, `name`, `billing_plan`, `meta_business_id`  
2. `accounts.company_id` (nullable, backfill gradual)  
3. Policies: usuário só vê workspaces da mesma company  

### Fase B — Phoenix SaaS UI (futuro)

- Super Admin Phoenix: listar companies, limites de canais, uso de IA  
- Não substituir dashboard Vue — estender via rotas `/app/phoenix-admin` ou portal externo  

### Fase C — Billing

- Stripe já tem `webhooks/stripe` no Chatwoot EE  
- Company como entidade de assinatura  

---

## 3. Isolamento e segurança

| Camada | Recomendação |
|--------|--------------|
| Dados | Row-level `company_id` em accounts |
| Meta tokens | Por workspace (já por `Channel::*`) |
| IA | API keys por company em vault (ENV criptografado) |
| Webhooks | `META_WEBHOOK_VERIFY_TOKEN` global + routing por `entry.id` → channel |

---

## 4. AI Agent no modelo

```
Workspace
 └── Captain::Assistant (nativo EE)
 └── AgentBot (webhook externo)
 └── Phoenix AI Bridge (futuro: OpenAI/Claude/Gemini/Ollama via docs/ai-architecture.md)
```

---

## 5. Decisões em aberto

1. Uma Company pode ter N Accounts? (recomendado: sim)  
2. SSO SAML por Company ou por Account?  
3. Marketing API: company-level ad account vs workspace-level  

---

*Nenhuma migration criada nesta fase.*
