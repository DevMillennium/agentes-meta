import { Worker } from "bullmq";
import { logger } from "../common/logger";
import { getRedisConnectionDescription, getRedisConnectionOptions } from "./redis.connection";
import { INBOUND_MESSAGES_QUEUE } from "./inbound-messages.queue";
import type { InboundMessageEvent } from "../modules/webhooks/services/inbound-events.parser";
import { processInboundMessageEvent } from "../modules/webhooks/services/inbound-events.service";

let inboundWorkerInstance: Worker | null = null;

export function startInboundMessagesWorker(): Worker {
  if (inboundWorkerInstance) {
    return inboundWorkerInstance;
  }

  inboundWorkerInstance = new Worker(
    INBOUND_MESSAGES_QUEUE,
    async (job: { id?: string | number; data: InboundMessageEvent }) => {
      await processInboundMessageEvent(job.data);
      logger.info({ jobId: job.id, channel: job.data.channel }, "Mensagem inbound processada.");
    },
    {
      connection: getRedisConnectionOptions()
    }
  );

  inboundWorkerInstance.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "Falha no worker de mensagens inbound.");
  });

  logger.info({ redis: getRedisConnectionDescription() }, "Worker de mensagens inbound conectado ao Redis.");
  return inboundWorkerInstance;
}
