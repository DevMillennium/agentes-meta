import { Queue } from "bullmq";
import { logger } from "../common/logger";
import { getRedisConnectionOptions, isRedisConfigured } from "./redis.connection";

export const AGENT_ORCHESTRATION_QUEUE = "agent-orchestration";

export interface AgentOrchestrationJobPayload {
  traceId: string;
  productId: string;
  objective: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requestedBy: string;
}

let queueInstance: Queue | null = null;

function getQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(AGENT_ORCHESTRATION_QUEUE, {
      connection: getRedisConnectionOptions()
    });
  }
  return queueInstance;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), ms))
  ]);
}

export async function enqueueAgentOrchestrationJob(payload: AgentOrchestrationJobPayload): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await withTimeout(
      getQueue().add("audit-orchestration-result", payload, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000
      },
      removeOnComplete: 1000,
      removeOnFail: 500
      }),
      1500
    );
  } catch (error) {
    logger.warn({ error, payload }, "Falha ao enfileirar job de orquestração.");
  }
}
