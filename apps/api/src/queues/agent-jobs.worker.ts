import { Worker } from "bullmq";
import { logger } from "../common/logger";
import { AGENT_ORCHESTRATION_QUEUE, type AgentOrchestrationJobPayload } from "./agent-jobs.queue";
import { getRedisConnectionDescription, getRedisConnectionOptions } from "./redis.connection";

let workerInstance: Worker | null = null;

export function startAgentJobsWorker(): Worker {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(
    AGENT_ORCHESTRATION_QUEUE,
    async (job: { id?: string | number; data: AgentOrchestrationJobPayload }) => {
      logger.info(
        {
          jobId: job.id,
          traceId: job.data.traceId,
          productId: job.data.productId,
          riskLevel: job.data.riskLevel
        },
        "Worker processou job de orquestração."
      );
    },
    {
      connection: getRedisConnectionOptions()
    }
  );

  workerInstance.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "Falha no processamento do worker.");
  });

  workerInstance.on("completed", (job) => {
    logger.debug({ jobId: job.id }, "Job concluído com sucesso.");
  });

  logger.info({ redis: getRedisConnectionDescription() }, "Worker conectado ao Redis.");

  return workerInstance;
}
