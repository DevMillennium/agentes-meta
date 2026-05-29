import { logger } from "../../common/logger";
import { getChatwootInboxId } from "../../config/env";
import { ChatwootService, chatwootService } from "../chatwoot/chatwoot.service";
import type { ChatwootAttachmentInput } from "../chatwoot/chatwoot.types";
import type { NormalizedMessage } from "./types";

const log = logger.child({ module: "chatwoot-sync" });

export interface ChatwootSyncResult {
  skipped: boolean;
  reason?: string;
  contactId?: number;
  conversationId?: number;
  messageId?: number;
  sourceId?: string;
  /** true quando a conversa está sob atendimento humano (IA pausada). */
  humanHandoff?: boolean;
}

/**
 * FASE 6 — Sincroniza uma mensagem normalizada com o Chatwoot:
 * contato → conversa aberta → mensagem de entrada (incoming).
 *
 * Idempotente por mensagem (usa messageId como source_id no Chatwoot).
 * Nunca lança para o chamador: erros viram resultado `skipped`.
 */
export class ChatwootSyncService {
  constructor(private readonly chatwoot: ChatwootService = chatwootService) {}

  /** Registra uma resposta automática (IA) como mensagem outgoing no Chatwoot. */
  public async recordOutgoing(
    conversationId: number,
    content: string,
    contentAttributes?: Record<string, unknown>
  ): Promise<void> {
    if (!this.chatwoot.isReady()) return;
    try {
      await this.chatwoot.createOutgoingMessage(conversationId, content, { contentAttributes });
    } catch {
      /* não-fatal */
    }
  }

  public async syncInbound(message: NormalizedMessage): Promise<ChatwootSyncResult> {
    if (!this.chatwoot.isReady()) {
      return { skipped: true, reason: "chatwoot-not-configured" };
    }

    const inboxId = getChatwootInboxId(message.platform);
    if (!inboxId) {
      log.warn({ platform: message.platform }, "Sem inbox configurado para a plataforma.");
      return { skipped: true, reason: `no-inbox-for-${message.platform}` };
    }

    try {
      const sourceId = message.externalUserId;

      // 1) Buscar/Criar contato.
      let contact = await this.chatwoot.findContactBySourceId(sourceId);
      if (!contact) {
        contact = await this.chatwoot.createContact({
          inboxId,
          sourceId,
          identifier: sourceId,
          name: message.senderName ?? `${message.platform}:${sourceId}`,
          phoneNumber: message.platform === "whatsapp" ? `+${sourceId.replace(/\D/g, "")}` : undefined,
          additionalAttributes: {
            platform: message.platform,
            external_conversation_id: message.externalConversationId
          }
        });
      } else if (message.senderName && message.senderName !== contact.name) {
        await this.chatwoot.updateContact(contact.id, { name: message.senderName });
      }

      if (!contact) {
        return { skipped: true, reason: "contact-create-failed" };
      }

      // 2) source_id do contact_inbox (necessário para o canal API criar conversa).
      const contactSourceId =
        (await this.chatwoot.getContactSourceId(contact.id, inboxId)) ?? sourceId;

      // 3) Buscar/Criar conversa aberta.
      let conversation = await this.chatwoot.findOpenConversation(contact.id, inboxId);
      if (!conversation) {
        conversation = await this.chatwoot.createConversation({
          inboxId,
          contactId: contact.id,
          sourceId: contactSourceId,
          status: "open",
          additionalAttributes: {
            platform: message.platform,
            external_conversation_id: message.externalConversationId
          }
        });
      }

      if (!conversation) {
        return { skipped: true, reason: "conversation-create-failed", contactId: contact.id };
      }

      // 4) Criar mensagem de entrada (incoming), com anexos e dedupe.
      const attachments: ChatwootAttachmentInput[] = message.attachments
        .filter((a) => a.url)
        .map((a) => ({ url: a.url, type: a.type }));

      const created = await this.chatwoot.createIncomingMessage(conversation.id, message.text || "(sem texto)", {
        sourceId: message.messageId,
        attachments: attachments.length ? attachments : undefined,
        contentAttributes: {
          platform: message.platform,
          provider_message_id: message.messageId,
          message_type: message.messageType
        }
      });

      log.info(
        {
          platform: message.platform,
          contactId: contact.id,
          conversationId: conversation.id,
          messageId: created?.id
        },
        "Mensagem sincronizada no Chatwoot."
      );

      const aiPaused =
        conversation.status === "pending" ||
        Boolean(
          (conversation.custom_attributes as Record<string, unknown> | null | undefined)?.ai_paused
        );

      return {
        skipped: false,
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: created?.id,
        sourceId: contactSourceId,
        humanHandoff: aiPaused
      };
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : error, platform: message.platform },
        "Falha ao sincronizar mensagem no Chatwoot."
      );
      return { skipped: true, reason: "sync-error" };
    }
  }
}

export const chatwootSyncService = new ChatwootSyncService();
