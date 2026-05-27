import { RiskLevel } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import { logger } from "../../../common/logger";
import type { WhatsAppDeliveryStatus } from "./inbound-events.parser";

export async function recordWhatsAppDeliveryStatuses(items: WhatsAppDeliveryStatus[]): Promise<void> {
  if (items.length === 0) return;

  try {
    for (const item of items) {
      await prisma.agentAction.create({
        data: {
          agentName: "WhatsAppSalesAgent",
          actionType: "message_delivery_status",
          targetType: "whatsapp_message",
          targetId: item.wamid,
          reason: `Status de entrega Meta: ${item.status}`,
          riskLevel: RiskLevel.LOW,
          status: "SUCCESS",
          beforeData: {},
          afterData: {
            wamid: item.wamid,
            status: item.status,
            recipientId: item.recipientId,
            errors: item.errors as Prisma.InputJsonValue
          }
        }
      });
    }
  } catch (error) {
    logger.error({ error, count: items.length }, "Falha ao registrar status de entrega WhatsApp.");
  }
}
