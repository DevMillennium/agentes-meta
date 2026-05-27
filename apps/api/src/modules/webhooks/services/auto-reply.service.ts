import { RiskLevel } from "@prisma/client";
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

async function dispatchOutboundMessage(event: InboundMessageEvent, text: string): Promise<void> {
  if (event.channel === "whatsapp") {
    await metaApi.sendWhatsAppMessagePlaceholder({
      to: event.senderId,
      text
    });
    return;
  }

  await metaApi.sendInstagramMessagePlaceholder({
    recipient: event.senderId,
    text
  });
}

export async function sendAutomatedReply(
  event: InboundMessageEvent,
  leadId: string,
  conversationId: string
): Promise<void> {
  const reply = buildAutoReply(event);
  await dispatchOutboundMessage(event, reply.text);

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
      status: "SUCCESS",
      beforeData: {
        inboundText: event.text
      },
      afterData: {
        outboundText: reply.text,
        needsHumanHandoff: reply.needsHumanHandoff
      }
    }
  });
}
