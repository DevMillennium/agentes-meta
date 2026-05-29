import type {
  NormalizedAttachment,
  NormalizedMessage,
  NormalizedMessageType,
  NormalizedPlatform
} from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: unknown, unit: "s" | "ms" = "s"): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(n) && n > 0) {
    return new Date(unit === "s" ? n * 1000 : n).toISOString();
  }
  return new Date().toISOString();
}

function mapMimeToType(mime?: string): NormalizedAttachment["type"] {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  return "file";
}

// ---------------------------------------------------------------------------
// WhatsApp Cloud API — object: "whatsapp_business_account"
// ---------------------------------------------------------------------------
function normalizeWhatsApp(payload: any): NormalizedMessage[] {
  const out: NormalizedMessage[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value ?? {};
      const phoneNumberId = asString(value?.metadata?.phone_number_id);
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const nameByWaId = new Map<string, string>();
      for (const c of contacts) {
        const waId = asString(c?.wa_id);
        const name = asString(c?.profile?.name);
        if (waId && name) nameByWaId.set(waId, name);
      }

      const messages = Array.isArray(value?.messages) ? value.messages : [];
      for (const message of messages) {
        const from = asString(message?.from);
        const messageId = asString(message?.id);
        if (!from || !messageId) continue;

        const { type, text, attachments } = extractWhatsAppContent(message);
        out.push({
          platform: "whatsapp",
          externalUserId: from,
          externalConversationId: phoneNumberId || from,
          messageId,
          messageType: type,
          text,
          attachments,
          timestamp: toIso(message?.timestamp, "s"),
          senderName: nameByWaId.get(from),
          recipientId: phoneNumberId || undefined,
          rawPayload: message as Record<string, unknown>
        });
      }
    }
  }
  return out;
}

function extractWhatsAppContent(message: any): {
  type: NormalizedMessageType;
  text: string;
  attachments: NormalizedAttachment[];
} {
  const kind = asString(message?.type) || "text";
  const attachments: NormalizedAttachment[] = [];

  switch (kind) {
    case "text":
      return { type: "text", text: asString(message?.text?.body), attachments };
    case "button":
      return { type: "text", text: asString(message?.button?.text), attachments };
    case "interactive": {
      const reply =
        message?.interactive?.button_reply?.title ?? message?.interactive?.list_reply?.title;
      return { type: "postback", text: asString(reply), attachments };
    }
    case "image":
    case "audio":
    case "video":
    case "document":
    case "sticker": {
      const media = message?.[kind] ?? {};
      const mapped: NormalizedMessageType =
        kind === "document" || kind === "sticker" ? "file" : (kind as NormalizedMessageType);
      attachments.push({
        type: mapped === "file" ? "file" : (mapped as NormalizedAttachment["type"]),
        externalId: asString(media?.id) || undefined,
        mimeType: asString(media?.mime_type) || undefined
      });
      return { type: mapped, text: asString(media?.caption), attachments };
    }
    default:
      return { type: "text", text: "", attachments };
  }
}

// ---------------------------------------------------------------------------
// Messenger (object: "page") e Instagram (object: "instagram")
// Ambos usam entry[].messaging[]
// ---------------------------------------------------------------------------
function normalizeMessaging(payload: any, platform: NormalizedPlatform): NormalizedMessage[] {
  const out: NormalizedMessage[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const messaging = Array.isArray(entry?.messaging)
      ? entry.messaging
      : Array.isArray(entry?.standby)
        ? entry.standby
        : [];

    for (const event of messaging) {
      const senderId = asString(event?.sender?.id);
      const recipientId = asString(event?.recipient?.id);
      if (!senderId) continue;

      // Postback (botões/menu)
      if (event?.postback) {
        out.push({
          platform,
          externalUserId: senderId,
          externalConversationId: asString(entry?.id) || senderId,
          messageId: asString(event?.postback?.mid) || `pb-${asString(event?.timestamp) || Date.now()}`,
          messageType: "postback",
          text: asString(event?.postback?.title) || asString(event?.postback?.payload),
          attachments: [],
          timestamp: toIso(event?.timestamp, "ms"),
          recipientId: recipientId || undefined,
          rawPayload: event as Record<string, unknown>
        });
        continue;
      }

      const msg = event?.message;
      if (!msg) continue;
      // Ignora ecos das próprias páginas (mensagens enviadas por nós).
      if (msg?.is_echo) continue;

      const attachments = normalizeMessagingAttachments(msg?.attachments);
      const type: NormalizedMessageType = attachments.length ? attachments[0].type : "text";

      out.push({
        platform,
        externalUserId: senderId,
        externalConversationId: asString(entry?.id) || senderId,
        messageId: asString(msg?.mid) || `m-${asString(event?.timestamp) || Date.now()}`,
        messageType: type,
        text: asString(msg?.text),
        attachments,
        timestamp: toIso(event?.timestamp, "ms"),
        recipientId: recipientId || undefined,
        rawPayload: event as Record<string, unknown>
      });
    }
  }
  return out;
}

function normalizeMessagingAttachments(raw: unknown): NormalizedAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedAttachment[] = [];
  for (const att of raw) {
    const t = asString((att as any)?.type);
    const url = asString((att as any)?.payload?.url);
    const mapped: NormalizedAttachment["type"] =
      t === "image" || t === "audio" || t === "video" ? (t as NormalizedAttachment["type"]) : "file";
    out.push({ type: mapped, url: url || undefined, mimeType: undefined });
  }
  return out;
}

/**
 * Detecta a origem do payload Meta e devolve mensagens normalizadas.
 * Suporta WhatsApp, Messenger (page) e Instagram.
 */
export function normalizeMetaWebhook(payload: unknown): NormalizedMessage[] {
  const safe = (payload ?? {}) as any;
  const object = asString(safe?.object);

  if (object === "whatsapp_business_account") return normalizeWhatsApp(safe);
  if (object === "instagram") return normalizeMessaging(safe, "instagram");
  if (object === "page") return normalizeMessaging(safe, "facebook");

  // Fallback heurístico quando "object" não vem (ex.: emuladores antigos).
  if (Array.isArray(safe?.entry)) {
    const first = safe.entry[0] ?? {};
    if (Array.isArray(first?.changes) && first.changes[0]?.value?.messages) {
      return normalizeWhatsApp(safe);
    }
    if (Array.isArray(first?.messaging)) {
      return normalizeMessaging(safe, "instagram");
    }
  }
  return [];
}

/** Mapeia a plataforma normalizada para o canal usado internamente no envio Meta. */
export function platformToMetaChannel(platform: NormalizedPlatform): "whatsapp" | "instagram" | "facebook" {
  return platform;
}
