import axios, { AxiosError, type AxiosInstance } from "axios";
import { env, isChatwootConfigured } from "../../config/env";
import { logger } from "../../common/logger";
import type {
  ChatwootContact,
  ChatwootConversation,
  ChatwootConversationStatus,
  ChatwootMessage,
  CreateContactInput,
  CreateConversationInput,
  CreateMessageInput
} from "./chatwoot.types";

const log = logger.child({ module: "chatwoot" });

/**
 * Cliente de alto nível para a Application API do Chatwoot.
 *
 * Todas as credenciais vêm exclusivamente de variáveis de ambiente.
 * Os métodos retornam `null`/lançam erros controlados quando o Chatwoot
 * não está configurado, para nunca derrubar o pipeline de webhooks.
 */
export class ChatwootService {
  private client: AxiosInstance | null = null;

  public isReady(): boolean {
    return isChatwootConfigured();
  }

  private http(): AxiosInstance {
    if (!this.isReady()) {
      throw new Error(
        "Chatwoot não configurado. Defina CHATWOOT_ENABLED=true, CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID e CHATWOOT_API_ACCESS_TOKEN."
      );
    }
    if (!this.client) {
      const baseURL = `${env.CHATWOOT_BASE_URL.replace(/\/$/, "")}/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}`;
      this.client = axios.create({
        baseURL,
        timeout: env.CHATWOOT_HTTP_TIMEOUT_MS,
        headers: {
          api_access_token: env.CHATWOOT_API_ACCESS_TOKEN,
          "Content-Type": "application/json"
        }
      });
    }
    return this.client;
  }

  private describeError(error: unknown): { message: string; status?: number; data?: unknown } {
    if (error instanceof AxiosError) {
      return {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
    return { message: error instanceof Error ? error.message : "Erro desconhecido" };
  }

  // --------------------------------------------------------------------------
  // Contatos
  // --------------------------------------------------------------------------

  public async createContact(input: CreateContactInput): Promise<ChatwootContact | null> {
    try {
      const { data } = await this.http().post<{ payload: { contact: ChatwootContact; contact_inbox?: { source_id?: string } } }>(
        "/contacts",
        {
          inbox_id: input.inboxId,
          name: input.name,
          email: input.email,
          phone_number: input.phoneNumber,
          identifier: input.identifier ?? input.sourceId,
          source_id: input.sourceId,
          additional_attributes: input.additionalAttributes,
          custom_attributes: input.customAttributes
        }
      );
      const contact = data?.payload?.contact ?? null;
      if (contact) {
        log.info({ contactId: contact.id, sourceId: input.sourceId }, "Chatwoot: contato criado.");
      }
      return contact;
    } catch (error) {
      log.error({ ...this.describeError(error), sourceId: input.sourceId }, "Chatwoot: falha ao criar contato.");
      throw error;
    }
  }

  /**
   * Busca contato pelo identificador estável (source_id/identifier).
   * Usa o endpoint de busca do Chatwoot e filtra pelo identifier exato.
   */
  public async findContactBySourceId(sourceId: string): Promise<ChatwootContact | null> {
    try {
      const { data } = await this.http().get<{ payload: ChatwootContact[] }>("/contacts/search", {
        params: { q: sourceId }
      });
      const items = Array.isArray(data?.payload) ? data.payload : [];
      const match =
        items.find((c) => c.identifier === sourceId) ??
        items.find((c) => c.phone_number === sourceId) ??
        items[0] ??
        null;
      return match;
    } catch (error) {
      log.error({ ...this.describeError(error), sourceId }, "Chatwoot: falha ao buscar contato.");
      return null;
    }
  }

  public async updateContact(
    contactId: number,
    patch: Partial<Pick<CreateContactInput, "name" | "email" | "phoneNumber" | "additionalAttributes" | "customAttributes">>
  ): Promise<ChatwootContact | null> {
    try {
      const { data } = await this.http().put<{ payload: ChatwootContact }>(`/contacts/${contactId}`, {
        name: patch.name,
        email: patch.email,
        phone_number: patch.phoneNumber,
        additional_attributes: patch.additionalAttributes,
        custom_attributes: patch.customAttributes
      });
      return data?.payload ?? null;
    } catch (error) {
      log.error({ ...this.describeError(error), contactId }, "Chatwoot: falha ao atualizar contato.");
      throw error;
    }
  }

  /** Recupera o source_id do contact_inbox de um contato em um inbox específico. */
  public async getContactSourceId(contactId: number, inboxId: string | number): Promise<string | null> {
    try {
      const { data } = await this.http().get<{ payload: Array<{ source_id?: string; inbox?: { id?: number } }> }>(
        `/contacts/${contactId}/contactable_inboxes`
      );
      const list = Array.isArray(data?.payload) ? data.payload : [];
      const match = list.find((ci) => String(ci.inbox?.id ?? "") === String(inboxId)) ?? list[0];
      return match?.source_id ?? null;
    } catch (error) {
      log.warn({ ...this.describeError(error), contactId }, "Chatwoot: não foi possível obter source_id do contato.");
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Conversas
  // --------------------------------------------------------------------------

  public async createConversation(input: CreateConversationInput): Promise<ChatwootConversation | null> {
    try {
      const { data } = await this.http().post<ChatwootConversation>("/conversations", {
        inbox_id: input.inboxId,
        contact_id: input.contactId,
        source_id: input.sourceId,
        status: input.status ?? "open",
        additional_attributes: input.additionalAttributes,
        custom_attributes: input.customAttributes
      });
      log.info({ conversationId: data?.id, contactId: input.contactId }, "Chatwoot: conversa criada.");
      return data ?? null;
    } catch (error) {
      log.error({ ...this.describeError(error), contactId: input.contactId }, "Chatwoot: falha ao criar conversa.");
      throw error;
    }
  }

  /** Procura uma conversa aberta (open/pending) do contato no inbox indicado. */
  public async findOpenConversation(
    contactId: number,
    inboxId?: string | number
  ): Promise<ChatwootConversation | null> {
    try {
      const { data } = await this.http().get<{ payload: ChatwootConversation[] }>(
        `/contacts/${contactId}/conversations`
      );
      const items = Array.isArray(data?.payload) ? data.payload : [];
      const active = items.filter((c) => c.status === "open" || c.status === "pending");
      const scoped = inboxId ? active.filter((c) => String(c.inbox_id ?? "") === String(inboxId)) : active;
      return scoped[0] ?? active[0] ?? null;
    } catch (error) {
      log.warn({ ...this.describeError(error), contactId }, "Chatwoot: falha ao buscar conversa aberta.");
      return null;
    }
  }

  public async setConversationStatus(
    conversationId: number,
    status: ChatwootConversationStatus
  ): Promise<boolean> {
    try {
      await this.http().post(`/conversations/${conversationId}/toggle_status`, { status });
      return true;
    } catch (error) {
      log.error({ ...this.describeError(error), conversationId, status }, "Chatwoot: falha ao mudar status.");
      return false;
    }
  }

  public async assignConversation(conversationId: number, assigneeId: number): Promise<boolean> {
    try {
      await this.http().post(`/conversations/${conversationId}/assignments`, { assignee_id: assigneeId });
      return true;
    } catch (error) {
      log.error({ ...this.describeError(error), conversationId }, "Chatwoot: falha ao atribuir conversa.");
      return false;
    }
  }

  public async sendTypingStatus(conversationId: number, on: boolean): Promise<boolean> {
    try {
      await this.http().post(`/conversations/${conversationId}/toggle_typing_status`, {
        typing_status: on ? "on" : "off"
      });
      return true;
    } catch (error) {
      // Recurso opcional — não deve gerar erro fatal.
      log.debug({ ...this.describeError(error), conversationId }, "Chatwoot: typing status indisponível.");
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Mensagens
  // --------------------------------------------------------------------------

  public async createMessage(input: CreateMessageInput): Promise<ChatwootMessage | null> {
    try {
      const { data } = await this.http().post<ChatwootMessage>(
        `/conversations/${input.conversationId}/messages`,
        {
          content: input.content,
          message_type: input.messageType ?? "incoming",
          private: input.private ?? false,
          source_id: input.sourceId,
          content_attributes: input.contentAttributes,
          attachments: input.attachments?.length
            ? input.attachments.map((a) => ({ data_url: a.url, file_type: a.type }))
            : undefined
        }
      );
      return data ?? null;
    } catch (error) {
      log.error(
        { ...this.describeError(error), conversationId: input.conversationId },
        "Chatwoot: falha ao criar mensagem."
      );
      throw error;
    }
  }

  public createIncomingMessage(
    conversationId: number,
    content: string,
    extra?: Partial<CreateMessageInput>
  ): Promise<ChatwootMessage | null> {
    return this.createMessage({ ...extra, conversationId, content, messageType: "incoming" });
  }

  public createOutgoingMessage(
    conversationId: number,
    content: string,
    extra?: Partial<CreateMessageInput>
  ): Promise<ChatwootMessage | null> {
    return this.createMessage({ ...extra, conversationId, content, messageType: "outgoing" });
  }

  public addPrivateNote(conversationId: number, content: string): Promise<ChatwootMessage | null> {
    return this.createMessage({ conversationId, content, messageType: "outgoing", private: true });
  }
}

/** Instância compartilhada (singleton leve). */
export const chatwootService = new ChatwootService();
