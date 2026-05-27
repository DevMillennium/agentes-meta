import { RiskLevel } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import { defaultAgents } from "../../agents/services/default-agents";
import { MetaApiService } from "../../meta/services/meta-api.service";
import type { InboundMessageEvent } from "./inbound-events.parser";

const metaApi = new MetaApiService();

async function dispatchOutboundMessage(
  event: InboundMessageEvent,
  text: string
): Promise<{ sendOk: boolean; sendMeta?: Record<string, unknown> }> {
  if (event.channel === "whatsapp") {
    const result = await metaApi.sendWhatsAppTextMessage(event.senderId, text);
    return { sendOk: result.ok, sendMeta: { ...result } as Record<string, unknown> };
  }

  const result = await metaApi.sendInstagramTextMessage(event.senderId, text);
  return { sendOk: result.ok, sendMeta: { ...result } as Record<string, unknown> };
}

export async function sendAutomatedReply(
  event: InboundMessageEvent,
  leadId: string,
  conversationId: string
): Promise<void> {
  const agent =
    event.channel === "whatsapp" ? defaultAgents.whatsappSales : defaultAgents.instagramDirect;

  const decision = await agent.analyze(
    {
      channel: event.channel,
      conversationId,
      leadId,
      inboundText: event.text,
      senderName: event.senderName
    },
    {
      tenantId: "phoenix-global",
      userId: "auto-reply",
      traceId: `reply-${Date.now()}`,
      now: new Date().toISOString()
    }
  );

  const payload = decision.payload as { replyText: string; needsHumanHandoff: boolean };
  const replyText = payload.replyText;
  const { sendOk, sendMeta } = await dispatchOutboundMessage(event, replyText);

  await prisma.message.create({
    data: {
      conversationId,
      direction: "outbound",
      content: replyText
    }
  });

  if (payload.needsHumanHandoff) {
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
      agentName: agent.name,
      actionType: "send_automated_reply",
      targetType: "conversation",
      targetId: conversationId,
      reason: payload.needsHumanHandoff
        ? "Handoff humano após resposta segura."
        : "Resposta IA enviada ao lead.",
      riskLevel: payload.needsHumanHandoff ? RiskLevel.MEDIUM : RiskLevel.LOW,
      status: sendOk ? "SUCCESS" : "FAILED",
      beforeData: { inboundText: event.text },
      afterData: {
        outboundText: replyText,
        needsHumanHandoff: payload.needsHumanHandoff,
        delivery: (sendMeta ?? null) as Prisma.InputJsonValue
      }
    }
  });
}
