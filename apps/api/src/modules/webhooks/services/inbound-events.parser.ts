export type InboundChannel = "whatsapp" | "instagram";

export interface InboundMessageEvent {
  channel: InboundChannel;
  senderId: string;
  senderName?: string;
  text: string;
  externalMessageId?: string;
  conversationExternalId?: string;
  rawEvent: object;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseWhatsAppEntries(payload: any): InboundMessageEvent[] {
  const events: InboundMessageEvent[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      const contacts = Array.isArray(change?.value?.contacts) ? change.value.contacts : [];
      const senderNameByWaId = new Map<string, string>();
      for (const contact of contacts) {
        const waId = typeof contact?.wa_id === "string" ? contact.wa_id : "";
        const profileName = normalizeText(contact?.profile?.name);
        if (waId && profileName) senderNameByWaId.set(waId, profileName);
      }

      for (const message of messages) {
        const text = normalizeText(message?.text?.body);
        const senderId = normalizeText(message?.from);
        if (!text || !senderId) continue;

        events.push({
          channel: "whatsapp",
          senderId,
          senderName: senderNameByWaId.get(senderId),
          text,
          externalMessageId: normalizeText(message?.id) || undefined,
          conversationExternalId: normalizeText(change?.value?.metadata?.phone_number_id) || undefined,
          rawEvent: message as object
        });
      }
    }
  }

  return events;
}

function parseInstagramEntries(payload: any): InboundMessageEvent[] {
  const events: InboundMessageEvent[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const event of messaging) {
      const text = normalizeText(event?.message?.text);
      const senderId = normalizeText(event?.sender?.id);
      if (!text || !senderId) continue;

      events.push({
        channel: "instagram",
        senderId,
        text,
        externalMessageId: normalizeText(event?.message?.mid) || undefined,
        conversationExternalId: normalizeText(entry?.id) || undefined,
        rawEvent: event as object
      });
    }
  }

  return events;
}

export function parseInboundEvents(channel: InboundChannel, payload: unknown): InboundMessageEvent[] {
  const safePayload = (payload ?? {}) as object;
  if (channel === "whatsapp") return parseWhatsAppEntries(safePayload);
  return parseInstagramEntries(safePayload);
}
