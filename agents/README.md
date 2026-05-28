# Phoenix AI Control Center (Fase 1)

Camada local de automação segura para Cursor + macOS.

## Módulos

- `browser-agent`: automação de navegador com Playwright.
- `mac-agent`: automação local com whitelist de comandos.
- `supervisor-agent`: avaliação de risco e necessidade de aprovação humana.
- `tools-registry`: catálogo central das ferramentas permitidas.
- `logs`: trilha de auditoria e screenshots.

## Pré-requisitos

- macOS + Cursor
- Node.js 20+
- Dependências instaladas na raiz (`npm install`)
- Permissões no macOS (Acessibilidade e Automação)

## Comandos

```bash
# Lista ferramentas registradas
npm run agent:tools

# Supervisor (classifica risco)
npm run agent:supervisor -- "open_url" "https://business.facebook.com"

# Mac agent
npm run agent:mac -- now
npm run agent:mac -- openSafari
npm run agent:mac -- openUrlSafari "https://business.facebook.com"
npm run agent:mac -- listDir "/Users/thyagomesquita/Desktop/AGENTE"

# Browser agent
npm run agent:browser -- open "https://business.facebook.com"
npm run agent:browser -- screenshot "https://business.facebook.com" "meta-home.png"
npm run agent:browser -- extract "https://business.facebook.com" "title"
```

## Segurança aplicada

- Whitelist explícita de comandos no `mac-agent`.
- Bloqueio de padrões destrutivos (`rm`, `sudo`, `killall`, etc).
- Restrição de diretórios via `MAC_AGENT_ALLOWED_DIRS`.
- Restrição de hosts web via `BROWSER_AGENT_ALLOWED_HOSTS`.
- Logs de execução e falhas em `agents/logs`.
- `supervisor-agent` exige aprovação humana para ações sensíveis.

## Variáveis recomendadas

```env
# Diretórios permitidos para list/open no mac-agent
MAC_AGENT_ALLOWED_DIRS="/Users/thyagomesquita/Desktop/AGENTE,/Users/thyagomesquita/Desktop"

# Hosts permitidos para navegação Playwright
BROWSER_AGENT_ALLOWED_HOSTS="business.facebook.com,developers.facebook.com"
```

## Checklist de permissões macOS

1. `System Settings` → `Privacy & Security` → `Accessibility`
   - habilitar: Cursor, Terminal
2. `System Settings` → `Privacy & Security` → `Automation`
   - permitir controle de Safari, Finder e System Events quando solicitado

## Próximos passos (Fase 2)

- Expor `browser-agent` e `mac-agent` como ferramentas MCP.
- Adicionar políticas de aprovação no `supervisor-agent` por tipo de ação.
- Integrar auditoria dos agentes ao backend da Phoenix.
