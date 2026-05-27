import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./common/logger";
import { startAgentJobsWorker } from "./queues/agent-jobs.worker";
import { startInboundMessagesWorker } from "./queues/inbound-messages.worker";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Phoenix API rodando na porta ${env.PORT}`);
  if (env.ENABLE_WORKERS) {
    startAgentJobsWorker();
    startInboundMessagesWorker();
    logger.info("Worker BullMQ iniciado.");
  }
});
