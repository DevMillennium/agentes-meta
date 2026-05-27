import { RiskLevel } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import { MetaApiService } from "../../meta/services/meta-api.service";
import type { InboundMessageEvent } from "./inbound-events.parser";

const BUYING_INTENT_REGEX = /\b(comprar|valor|preco|preço|entrega|pagamento|pix|cartao|cartão)\b/i;
const CONFLICT_REGEX = /\b(reclama|procon|processo|golpe|enganado|denuncia|denúncia)\b/i;

const metaApi = new MetaApiService();

function buildAutoReply(event: InboundMessageEvent): { text: string; needsHumanHandoff: boolean } {
  const lowerText = event.text.toLowerCase();

  if (CONFLICT_REGEX.test(lowerText)) {
    return {
      text: "Recebi sua mensagem e vou encaminhar agora para um especialista humano te atender com prioridade.",
      needsHumanHandoff: true
    };
  }

  if (BUYING_INTENT_REGEX.test(lowerText)) {
    return {
      text:
        "Perfeito! Posso te ajudar com disponibilidade, valor e entrega agora. Me confirma sua cidade para eu te passar a melhor condição.",
      needsHumanHandoff: false
    };
  }

  return {
    text:
      "Obrigado por chamar a Phoenix Global. Me diga qual produto você procura e sua cidade para eu te passar opções com pronta entrega.",
    needsHumanHandoff: false
  };
}

async function dispatchOutboundMessage(
  event: InboundMessageEvent,
  text: string
): Promise<{ sendOk: boolean; sendMeta?: Record<string, unknown> }> {
  if (event.channel === "whatsapp") {
    const result = await metaApi.sendWhatsAppTextMessage(event.senderId, text);
    return {
      sendOk: result.ok,
      sendMeta: { ...result } as Record<string, unknown>
    };
  }

  const result = await metaApi.sendInstagramTextMessage(event.senderId, text);
  return {
    sendOk: result.ok,
    sendMeta: { ...result } as Record<string, unknown>
  };
}

export async function sendAutomatedReply(
  event: InboundMessageEvent,
  leadId: string,
  conversationId: string
): Promise<void> {
  const reply = buildAutoReply(event);
  const { sendOk, sendMeta } = await dispatchOutboundMessage(event, reply.text);

  await prisma.message.create({
    data: {
      conversationId,
      direction: "outbound",
      content: reply.text
    }
  });

  if (reply.needsHumanHandoff) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "aguardando_humano",
        nextAction: "vendedor humano assumir conversa"
      }
    });
  }

  await prisma.agentAction.create({
    data: {
      agentName: event.channel === "whatsapp" ? "WhatsAppSalesAgent" : "InstagramDirectAgent",
      actionType: "send_automated_reply",
      targetType: "conversation",
      targetId: conversationId,
      reason: reply.needsHumanHandoff
        ? "Mensagem de risco/conflito detectada; resposta segura enviada e handoff humano ativado."
        : "Resposta automática enviada com base na intenção detectada.",
      riskLevel: reply.needsHumanHandoff ? RiskLevel.MEDIUM : RiskLevel.LOW,
      status: sendOk ? "SUCCESS" : "FAILED",
      beforeData: {
        inboundText: event.text
      },
      afterData: {
        outboundText: reply.text,
        needsHumanHandoff: reply.needsHumanHandoff,
        delivery: (sendMeta ?? null) as Prisma.InputJsonValue
      }
    }
  });
}
