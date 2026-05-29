import { logger } from "../../common/logger";
import { getPlatformByInboxId, type ChatwootPlatform } from "../../config/env";
import { metaOutboundService, MetaOutboundService } from "./meta-outbound.service";

const log = logger.child({ module: "chatwoot-webhook" });

export interface ChatwootWebhookResult {
  handled: boolean;
  reason: string;
  platform?: ChatwootPlatform;
  delivered?: boolean;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** message_type pode vir como número (0/1) ou string ("incoming"/"outgoing"). */
function isOutgoing(payload: any): boolean {
  const mt = payload?.message_type;
  return mt === "outgoing" || mt === 1 || mt === "1";
}

function isAutomated(payload: any): boolean {
  const attrs = payload?.content_attributes ?? {};
  return Boolean(attrs?.automated);
}

function isPrivate(payload: any): boolean {
  return Boolean(payload?.private);
}

/**
 * Resolve o identificador externo do destinatário (PSID/IGSID/telefone)
 * a partir do payload do Chatwoot.
 */
function resolveRecipientExternalId(payload: any): string {
  const conversation = payload?.conversation ?? {};
  const sender = conversation?.meta?.sender ?? payload?.sender ?? {};
  return (
    asString(conversation?.contact_inbox?.source_id) ||
    asString(sender?.identifier) ||
    asString(sender?.phone_number).replace(/\D/g, "") ||
    asString(payload?.contact_inbox?.source_id)
  );
}

function resolvePlatform(payload: any): ChatwootPlatform | undefined {
  const conversation = payload?.conversation ?? {};
  const fromAttrs = asString(conversation?.additional_attributes?.platform) as ChatwootPlatform;
  if (fromAttrs === "instagram" || fromAttrs === "facebook" || fromAttrs === "whatsapp") {
    return fromAttrs;
  }
  const inboxId = conversation?.inbox_id ?? payload?.inbox?.id ?? payload?.inbox_id;
  return getPlatformByInboxId(inboxId);
}

/**
 * FASE 8 — Processa webhooks do Chatwoot.
 *
 * Quando um atendente humano envia uma mensagem outgoing (não privada e
 * não automatizada), reenviamos pelo canal Meta correspondente.
 * Anti-loop: ignoramos incoming, notas privadas e mensagens marcadas
 * como `automated` (geradas pela própria IA).
 */
export class ChatwootWebhookService {
  constructor(private readonly outbound: MetaOutboundService = metaOutboundService) {}

  public async process(payload: any): Promise<ChatwootWebhookResult> {
    const event = asString(payload?.event);

    if (event !== "message_created") {
      return { handled: false, reason: `ignored-event:${event || "unknown"}` };
    }

    if (!isOutgoing(payload)) {
      return { handled: false, reason: "not-outgoing" };
    }
    if (isPrivate(payload)) {
      return { handled: false, reason: "private-note" };
    }
    if (isAutomated(payload)) {
      // Resposta da própria IA já foi enviada ao usuário — evita loop.
      return { handled: false, reason: "automated-echo" };
    }

    const platform = resolvePlatform(payload);
    if (!platform) {
      log.warn({ inbox: payload?.conversation?.inbox_id }, "Plataforma não identificada no webhook Chatwoot.");
      return { handled: false, reason: "platform-unknown" };
    }

    const recipientId = resolveRecipientExternalId(payload);
    const content = asString(payload?.content);
    if (!recipientId || !content) {
      return { handled: false, reason: "missing-recipient-or-content", platform };
    }

    const send = await this.outbound.sendText(platform, recipientId, content);
    log.info(
      { platform, recipientId, ok: send.ok, provider: send.provider },
      "Mensagem do atendente reenviada ao canal Meta."
    );

    return {
      handled: true,
      reason: send.ok ? "delivered" : `send-failed:${send.error ?? "unknown"}`,
      platform,
      delivered: send.ok
    };
  }
}

export const chatwootWebhookService = new ChatwootWebhookService();
