/**
 * Tipos da API do Chatwoot (Application API v1).
 * Doc: https://www.chatwoot.com/developers/api/
 */

export type ChatwootConversationStatus = "open" | "resolved" | "pending" | "snoozed";
export type ChatwootMessageType = "incoming" | "outgoing";

export interface ChatwootContact {
  id: number;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  identifier?: string | null;
  custom_attributes?: Record<string, unknown> | null;
  additional_attributes?: Record<string, unknown> | null;
}

export interface ChatwootContactInbox {
  source_id: string;
  inbox?: { id: number; name?: string } | null;
}

export interface ChatwootConversation {
  id: number;
  account_id?: number;
  inbox_id?: number;
  status?: ChatwootConversationStatus;
  contact_id?: number;
  meta?: Record<string, unknown>;
  custom_attributes?: Record<string, unknown> | null;
  additional_attributes?: Record<string, unknown> | null;
}

export interface ChatwootMessage {
  id: number;
  content?: string | null;
  message_type?: number; // 0 incoming, 1 outgoing, 2 activity, 3 template
  private?: boolean;
  conversation_id?: number;
  source_id?: string | null;
  content_attributes?: Record<string, unknown> | null;
}

export interface ChatwootAttachmentInput {
  /** URL pública do arquivo (Chatwoot baixa e anexa). */
  url?: string;
  /** Tipo lógico para apresentação. */
  type?: "image" | "audio" | "video" | "file";
}

export interface CreateContactInput {
  inboxId: string | number;
  /** Identificador estável do contato no canal de origem (ex.: PSID, IGSID, telefone). */
  sourceId: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  /** Identificador único cross-inbox no Chatwoot. */
  identifier?: string;
  additionalAttributes?: Record<string, unknown>;
  customAttributes?: Record<string, unknown>;
}

export interface CreateConversationInput {
  inboxId: string | number;
  contactId: number;
  /** source_id do contact_inbox (necessário para roteamento de canal API). */
  sourceId: string;
  status?: ChatwootConversationStatus;
  additionalAttributes?: Record<string, unknown>;
  customAttributes?: Record<string, unknown>;
}

export interface CreateMessageInput {
  conversationId: number;
  content: string;
  messageType?: ChatwootMessageType;
  private?: boolean;
  contentAttributes?: Record<string, unknown>;
  /** Evita duplicar mensagens vindas do mesmo provedor (ex.: mid do Meta). */
  sourceId?: string;
  attachments?: ChatwootAttachmentInput[];
}
