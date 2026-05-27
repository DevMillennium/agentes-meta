import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./common/logger";
import { startAgentJobsWorker } from "./queues/agent-jobs.worker";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Phoenix API rodando na porta ${env.PORT}`);
  if (env.ENABLE_WORKERS) {
    startAgentJobsWorker();
    logger.info("Worker BullMQ iniciado.");
  }
});
