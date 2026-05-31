# P3 — Auto-reply comentários Facebook / Instagram (roadmap)

Referência Chatrace: [Messenger](https://docs.chatrace.com/) e [Instagram](https://docs.chatrace.com/) — artigos de auto-reply em posts, stories e mentions.

**Status:** 📋 planejado — **não** implementado no core Phoenix (DM + Captain já cobrem atendimento principal).

---

## Por que é P3

| Aspecto | DM (hoje) | Comentários / Stories |
|---------|-----------|------------------------|
| Webhook Meta | `messages` ✅ | `feed`, `comments`, `story_insights` |
| Permissões | `pages_messaging` ✅ | `pages_manage_engagement`, `instagram_manage_comments` |
| Produto Chatwoot | Inbox nativo ✅ | Sem UI equivalente ao Chatrace |
| Esforço | Operacional | Novo serviço + app review Meta |

---

## Escopo futuro (quando negócio exigir)

1. **`Phoenix::CommentWebhookController`** — recebe eventos `feed` / Instagram comments.
2. **`Phoenix::CommentReplyJob`** — regras: palavra-chave, DM link, handoff humano.
3. **Config por página** — JSON em `InstallationConfig` ou tabela `phoenix_comment_rules`.
4. **Logs** — mesmo padrão `Phoenix::MetaWebhookLogger`.

---

## Pré-requisitos Meta Developer

- App `27447238071580159` (ou produção).
- Webhook fields: `feed`, `comments` (Page), `messages` (Instagram).
- App Review para permissões de engajamento público.

---

## Alternativa imediata (sem P3)

- Responder comentários **manualmente** no Meta Business Suite.
- Campanha que direciona para **Messenger** (link na bio / post) → Captain na inbox #4.

---

## Relacionado

- [phoenix-chatrace-parity.md](./phoenix-chatrace-parity.md) — seção P3
- [phoenix-manual-pendente.md](./phoenix-manual-pendente.md)
