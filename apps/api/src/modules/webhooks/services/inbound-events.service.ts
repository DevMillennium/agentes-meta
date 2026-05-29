import { LeadTemperature, RiskLevel } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import { env } from "../../../config/env";
import type { InboundMessageEvent } from "./inbound-events.parser";
import { sendAutomatedReply } from "./auto-reply.service";

const BUYING_INTENT_REGEX = /\b(comprar|valor|preco|preço|entrega|pagamento|pix|cartao|cartão)\b/i;

function detectLeadTemperature(text: string): LeadTemperature {
  if (BUYING_INTENT_REGEX.test(text)) return LeadTemperature.HOT;
  return LeadTemperature.WARM;
}

export async function processInboundMessageEvent(event: InboundMessageEvent): Promise<void> {
  const source = event.channel === "whatsapp" ? "WhatsApp" : "Instagram Direct";
  const leadTemperature = detectLeadTemperature(event.text);
  const leadFilter =
    event.channel === "whatsapp"
      ? { phone: event.senderId, source }
      : { instagramHandle: event.senderId, source };

  const existingLead = await prisma.lead.findFirst({ where: leadFilter });
  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          ...(event.senderName ? { name: event.senderName } : {}),
          temperature: leadTemperature,
          status: leadTemperature === LeadTemperature.HOT ? "lead_quente" : "qualificando",
          nextAction:
            leadTemperature === LeadTemperature.HOT
              ? "encaminhar para vendedor humano"
              : "continuar qualificação automática"
        }
      })
    : await prisma.lead.create({
        data: {
          source,
          phone: event.channel === "whatsapp" ? event.senderId : null,
          instagramHandle: event.channel === "instagram" ? event.senderId : null,
          name: event.senderName ?? null,
          temperature: leadTemperature,
          status: leadTemperature === LeadTemperature.HOT ? "lead_quente" : "qualificando",
          nextAction:
            leadTemperature === LeadTemperature.HOT
              ? "encaminhar para vendedor humano"
              : "continuar qualificação automática"
        }
      });

  const conversationExternalId = event.conversationExternalId ?? event.senderId;
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      leadId: lead.id,
      channel: event.channel,
      externalId: conversationExternalId
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const conversation = existingConversation
    ? existingConversation
    : await prisma.conversation.create({
        data: {
          leadId: lead.id,
          channel: event.channel,
          externalId: conversationExternalId
        }
      });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      content: event.text
    }
  });

  await prisma.agentAction.create({
    data: {
      agentName: event.channel === "whatsapp" ? "WhatsAppSalesAgent" : "InstagramDirectAgent",
      actionType: "process_inbound_message",
      targetType: "conversation",
      targetId: conversation.id,
      beforeData: event.rawEvent,
      afterData: {
        leadId: lead.id,
        leadTemperature,
        conversationId: conversation.id
      },
      reason:
        leadTemperature === LeadTemperature.HOT
          ? "Mensagem com intenção de compra, acionado handoff para CRM."
          : "Mensagem recebida e classificada para continuidade automática.",
      riskLevel: leadTemperature === LeadTemperature.HOT ? RiskLevel.MEDIUM : RiskLevel.LOW,
      status: "SUCCESS"
    }
  });

  // Com Chatwoot ativo, IA + resposta saem pela ponte omnichannel (evita duplicar).
  if (!env.CHATWOOT_ENABLED) {
    await sendAutomatedReply(event, lead.id, conversation.id);
  }
}
