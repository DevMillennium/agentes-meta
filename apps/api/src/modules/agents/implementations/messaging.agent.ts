import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { prisma } from "../../../common/prisma";
import { generateChatCompletion, type ChatMessage } from "../../ai/openai.service";
import { AgentBase } from "../base/agent.base";

const PHOENIX_SYSTEM = `Você é vendedor da Phoenix Global Imports (Fortaleza/CE).
Tom: profissional, direto, amigável. Vende eletrônicos (Apple, Samsung, Xiaomi) com garantia e nota.
Regras: não prometa cura, renda garantida ou claims proibidos pela Meta. Máximo 3 frases curtas.
Se pedirem preço sem produto, pergunte modelo e cidade. WhatsApp: +5585994482323.`;

export interface MessagingInput {
  channel: "whatsapp" | "instagram";
  conversationId: string;
  leadId: string;
  inboundText: string;
  senderName?: string;
}

export class MessagingSalesAgent extends AgentBase<
  MessagingInput,
  { replyText: string; needsHumanHandoff: boolean },
  { replyText: string }
> {
  constructor(
    public readonly name: string,
    public readonly riskProfile: "medium" = "medium"
  ) {
    super();
  }

  public async analyze(
    input: MessagingInput,
    context: AgentContext
  ): Promise<AgentDecision<{ replyText: string; needsHumanHandoff: boolean }>> {
    const conflict = /\b(reclama|procon|processo|golpe|enganado|denúncia|denuncia)\b/i.test(
      input.inboundText
    );

    if (conflict) {
      return {
        agentName: this.name,
        actionType: "respond_with_handoff",
        riskLevel: "medium",
        reason: "Conflito detectado; handoff humano.",
        payload: {
          replyText:
            "Recebi sua mensagem e vou encaminhar agora para um especialista humano te atender com prioridade.",
          needsHumanHandoff: true
        },
        requiresApproval: false
      };
    }

    const history = await prisma.message.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { sentAt: "asc" },
      take: 12
    });

    const messages: ChatMessage[] = [
      { role: "system", content: PHOENIX_SYSTEM },
      ...history.map((m) => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.content
      })),
      { role: "user", content: input.inboundText }
    ];

    const replyText = await generateChatCompletion(messages, { maxTokens: 280, temperature: 0.6 });
    this.log("generate_reply", context, { channel: input.channel, conversationId: input.conversationId });

    return {
      agentName: this.name,
      actionType: "respond_message",
      riskLevel: "low",
      reason: "Resposta gerada para lead.",
      payload: { replyText, needsHumanHandoff: false },
      requiresApproval: false
    };
  }

  public async execute(
    decision: AgentDecision<{ replyText: string; needsHumanHandoff: boolean }>,
    _context: AgentContext
  ): Promise<AgentExecutionResult<{ replyText: string }>> {
    return {
      success: true,
      message: "Resposta pronta para envio.",
      data: { replyText: decision.payload.replyText }
    };
  }
}
