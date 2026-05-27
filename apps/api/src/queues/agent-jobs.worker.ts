import { Worker } from "bullmq";
import { logger } from "../common/logger";
import { AgentOrchestrator } from "../modules/agents/services/agent.orchestrator";
import { defaultAgents } from "../modules/agents/services/default-agents";
import { AGENT_ORCHESTRATION_QUEUE, type AgentOrchestrationJobPayload } from "./agent-jobs.queue";
import { getRedisConnectionDescription, getRedisConnectionOptions } from "./redis.connection";

const orchestrator = new AgentOrchestrator(defaultAgents);
let workerInstance: Worker | null = null;

export function startAgentJobsWorker(): Worker {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(
    AGENT_ORCHESTRATION_QUEUE,
    async (job: { id?: string | number; data: AgentOrchestrationJobPayload }) => {
      logger.info(
        { jobId: job.id, traceId: job.data.traceId, productId: job.data.productId },
        "Executando ciclo de marketing em background."
      );

      const result = await orchestrator.runMarketingCycle(
        {
          objective: "Vender produto prioritário",
          maxDailyBudget: 50,
          productId: job.data.productId,
          campaignType: "messages"
        },
        job.data.requestedBy
      );

      logger.info({ jobId: job.id, success: result.success, message: result.message }, "Ciclo concluído.");
      return result;
    },
    {
      connection: getRedisConnectionOptions()
    }
  );

  workerInstance.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "Falha no processamento do worker.");
  });

  logger.info({ redis: getRedisConnectionDescription() }, "Worker de agentes conectado ao Redis.");
  return workerInstance;
}
