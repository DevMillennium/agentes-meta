import { logger } from "../../common/logger";
import { ChatwootService, chatwootService } from "../chatwoot/chatwoot.service";

const log = logger.child({ module: "human-handoff" });

export interface HandoffConversation {
  conversationId: number;
  /** Id de agente humano para atribuição automática (opcional). */
  assigneeId?: number;
}

/**
 * FASE 7 — Orquestra o handoff para atendimento humano.
 *
 * - Marca a conversa como "pending" (fila de atendimento humano no Chatwoot).
 * - Adiciona uma nota privada explicando o motivo.
 * - Opcionalmente atribui a um agente.
 *
 * O backend NÃO deve responder com IA enquanto a conversa estiver em handoff;
 * isso é refletido via custom attribute lido pela AiRoutingService.
 */
export class HumanHandoffService {
  constructor(private readonly chatwoot: ChatwootService = chatwootService) {}

  public async requestHuman(conversation: HandoffConversation, reason: string): Promise<boolean> {
    if (!this.chatwoot.isReady()) {
      log.warn({ conversationId: conversation.conversationId }, "Handoff solicitado sem Chatwoot configurado.");
      return false;
    }

    try {
      await this.chatwoot.addPrivateNote(
        conversation.conversationId,
        `🤝 Handoff para humano solicitado.\nMotivo: ${reason}`
      );
      await this.chatwoot.setConversationStatus(conversation.conversationId, "pending");

      if (conversation.assigneeId) {
        await this.chatwoot.assignConversation(conversation.conversationId, conversation.assigneeId);
      }

      log.info({ conversationId: conversation.conversationId, reason }, "Handoff humano registrado.");
      return true;
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : error, conversationId: conversation.conversationId },
        "Falha ao registrar handoff humano."
      );
      return false;
    }
  }

  /** Reativa a IA marcando a conversa como aberta novamente. */
  public async resumeAi(conversationId: number): Promise<boolean> {
    if (!this.chatwoot.isReady()) return false;
    return this.chatwoot.setConversationStatus(conversationId, "open");
  }
}

export const humanHandoffService = new HumanHandoffService();
