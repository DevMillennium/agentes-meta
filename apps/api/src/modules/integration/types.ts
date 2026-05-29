/**
 * Formato interno unificado de mensagens (canal-agnóstico).
 *
 * Toda mensagem recebida do Meta (Instagram, Messenger, WhatsApp) é
 * convertida para este formato antes de qualquer sincronização com o
 * Chatwoot ou roteamento de IA. Mantém `rawPayload` para auditoria.
 */

export type NormalizedPlatform = "instagram" | "facebook" | "whatsapp";

export type NormalizedMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "postback"
  | "comment";

export interface NormalizedAttachment {
  type: "image" | "audio" | "video" | "file";
  url?: string;
  mimeType?: string;
  /** Id do anexo no provedor (ex.: media_id do WhatsApp). */
  externalId?: string;
}

export interface NormalizedMessage {
  platform: NormalizedPlatform;
  /** Identificador estável do usuário no canal (PSID/IGSID/telefone). */
  externalUserId: string;
  /** Identificador estável da conversa/thread no canal. */
  externalConversationId: string;
  /** Id da mensagem no provedor (mid/wamid) — usado para deduplicação. */
  messageId: string;
  messageType: NormalizedMessageType;
  text: string;
  attachments: NormalizedAttachment[];
  /** ISO 8601. */
  timestamp: string;
  /** Nome de exibição quando disponível no payload. */
  senderName?: string;
  /** Id do recipiente/página/número que recebeu (útil para escolher o canal de resposta). */
  recipientId?: string;
  /** Payload bruto do provedor para auditoria e reprocessamento. */
  rawPayload: Record<string, unknown>;
}
