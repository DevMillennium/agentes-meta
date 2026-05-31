# Captain — assistente Fernanda (OpenAI)

O **Captain** usa a API OpenAI **sem** URL de webhook em «Configurações → Robôs». A chave em **Integrações → OpenAI** é reutilizada automaticamente pelo script de setup.

## Configurar (uma vez)

```bash
./phoenix captain
# ou
./scripts/phoenix-setup-captain-assistant.sh
```

O script:

1. Copia a API key da integração OpenAI → `CAPTAIN_OPEN_AI_API_KEY`
2. Cria/atualiza o assistente **Fernanda** (nome configurável via `PHOENIX_CAPTAIN_NAME`)
3. Liga à inbox **FacebookPage** (Messenger/Instagram) **e** à inbox **WebWidget** (site)
4. Desativa a coleta de e-mail pré-chat no widget (o bot assume a conversa)
5. Reinicia o Rails para carregar a chave no boot

> A Fernanda atende em **todos** os canais ligados: Messenger, Instagram (via página) e o **widget do site**. Confirmado por E2E (`./phoenix e2e` e teste no widget).

## Onde ajustar no painel

| Tela | URL |
|------|-----|
| Assistentes | `/app/accounts/1/captain/assistants` |
| Playground (testar) | `/app/accounts/1/captain/:id/playground` |
| Configurações Captain | `/app/accounts/1/settings/captain` |
| Inboxes do assistente | `/app/accounts/1/captain/:id/inboxes` |

## Como responde automaticamente

- Com Captain ligado à inbox, `inbox.active_bot?` fica verdadeiro.
- **Novas** conversas começam em status **pending**.
- Mensagens **entrantes** disparam `Captain::Conversation::ResponseBuilderJob`.

Conversas antigas já **open** não são retomadas pelo bot — abra uma conversa nova ou volte status para pending.

## Robô (Agent Bot) vs Captain

| | Captain | Agent Bot (Robôs) |
|---|---------|-------------------|
| Webhook URL | Não precisa | Obrigatório (seu servidor) |
| OpenAI em Integrações | Reutilizada pelo script | Não usa diretamente |
| Uso típico | Fernanda / FAQ / handoff | n8n, Dialogflow, API custom |

## Variáveis opcionais

```bash
PHOENIX_CAPTAIN_NAME=Fernanda
OPENAI_MODEL=gpt-4o-mini
CHATWOOT_ACCOUNT_ID=1
OPENAI_API_KEY=sk-...   # se não houver hook OpenAI na conta
```
