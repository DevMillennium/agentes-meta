# Phoenix Digital Omnichannel

Plataforma omnichannel baseada em **Chatwoot** (Docker) com rebranding Phoenix, webhooks Meta unificados e scripts de operação.

## Início rápido

```bash
cp .env.chatwoot.example .env.chatwoot   # ajuste variáveis
docker compose -f docker-compose.chatwoot.yml up -d
./phoenix branding
./phoenix meta
./phoenix activate
./phoenix open
```

## CLI

```bash
./phoenix branding    # marca visual + logos
./phoenix meta        # Meta + webhooks
./phoenix activate    # limpa inboxes legados
./phoenix connect     # telas OAuth (Facebook / Instagram / WhatsApp)
./phoenix tunnel      # HTTPS dev (Cloudflare)
./phoenix go-live     # automação máxima (Meta, Captain, E2E)
./phoenix verify      # checagem operacional
./phoenix captain     # assistente IA Fernanda
```

Manual (Meta Console, DM real, domínio fixo): [docs/phoenix-manual-pendente.md](docs/phoenix-manual-pendente.md)

Chatrace → Phoenix: [docs/phoenix-chatrace-parity.md](docs/phoenix-chatrace-parity.md) · P3 comentários: [docs/phoenix-p3-comments-roadmap.md](docs/phoenix-p3-comments-roadmap.md)

## Documentação

- [Acesso ao painel](docs/phoenix-omnichannel-acesso.md)
- [Conectar canais (OAuth)](docs/phoenix-conectar-canais.md)
- [Relatório master](docs/phoenix-master-report.md)
