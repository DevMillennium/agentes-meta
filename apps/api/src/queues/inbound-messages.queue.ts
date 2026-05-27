import { Queue } from "bullmq";
import { logger } from "../common/logger";
import { getRedisConnectionOptions } from "./redis.connection";
import type { InboundMessageEvent } from "../modules/webhooks/services/inbound-events.parser";

export const INBOUND_MESSAGES_QUEUE = "inbound-messages";

let queueInstance: Queue | null = null;

function getQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(INBOUND_MESSAGES_QUEUE, {
      connection: getRedisConnectionOptions()
    });
  }
  return queueInstance;
}

export async function enqueueInboundMessageEvent(event: InboundMessageEvent): Promise<void> {
  try {
    await getQueue().add("process-inbound-message", event, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000
      },
      removeOnComplete: 1000,
      removeOnFail: 500
    });
  } catch (error) {
    logger.warn({ error, event }, "Falha ao enfileirar mensagem inbound.");
  }
}
