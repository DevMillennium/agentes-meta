import { logger } from "../../common/logger";
import { generateChatCompletion, type ChatMessage } from "../ai/ai.service";
import type { NormalizedMessage } from "./types";

const log = logger.child({ module: "ai-routing" });

/** Estado mínimo da conversa necessário para decidir roteamento. */
export interface RoutingConversation {
  /** Id da conversa no Chatwoot (quando houver). */
  conversationId?: number;
  /** Plataforma de origem. */
  platform: NormalizedMessage["platform"];
  /** Quando true, a IA não responde (atendimento humano no comando). */
  humanHandoff?: boolean;
  /** Histórico opcional para dar contexto à IA. */
  history?: ChatMessage[];
  /** Nome do contato, se conhecido. */
  contactName?: string;
}

export interface AutoReplyDecision {
  autoReply: boolean;
  reason: string;
  requiresHuman: boolean;
}

/** Sinais textuais que indicam necessidade de humano. */
const HUMAN_INTENT_REGEX =
  /\b(falar com (um |uma )?(atendente|humano|pessoa|vendedor)|reclama|reclamação|processo|advogad|cancelar|chargeback|fraude|gerente)\b/i;

const SYSTEM_PROMPT = `Você é o assistente de atendimento omnichannel da plataforma.
Responda de forma curta, cordial e objetiva, em português do Brasil.
Se não souber algo ou se o cliente pedir explicitamente um humano, indique que vai chamar um atendente.
Nunca invente preços, prazos ou dados que você não tenha.`;

/**
 * FASE 7 — Decide se a IA deve responder e gera a resposta.
 * É agnóstica de canal: opera sobre a mensagem normalizada.
 */
export class AiRoutingService {
  public shouldAutoReply(conversation: RoutingConversation, message: NormalizedMessage): AutoReplyDecision {
    if (conversation.humanHandoff) {
      return { autoReply: false, reason: "human-handoff-active", requiresHuman: false };
    }

    if (message.messageType !== "text" && message.messageType !== "postback") {
      return {
        autoReply: false,
        reason: `unsupported-type-${message.messageType}`,
        requiresHuman: false
      };
    }

    if (HUMAN_INTENT_REGEX.test(message.text)) {
      return { autoReply: false, reason: "human-intent-detected", requiresHuman: true };
    }

    if (!message.text.trim()) {
      return { autoReply: false, reason: "empty-text", requiresHuman: false };
    }

    return { autoReply: true, reason: "auto-reply-eligible", requiresHuman: false };
  }

  public async generateReply(
    conversation: RoutingConversation,
    message: NormalizedMessage
  ): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(conversation.history ?? []),
      { role: "user", content: message.text }
    ];

    try {
      const reply = await generateChatCompletion(messages, { maxTokens: 400, temperature: 0.6 });
      return reply.trim();
    } catch (error) {
      log.warn({ error, conversationId: conversation.conversationId }, "Falha ao gerar resposta IA.");
      return "Recebi sua mensagem! Já já um atendente te responde por aqui.";
    }
  }
}

export const aiRoutingService = new AiRoutingService();
