import { randomUUID } from "node:crypto";
import type { AgentContext } from "@phoenix/shared";
import { getAgentByKey } from "./agent-catalog";
import { defaultAgents } from "./default-agents";
import type { AgentRegistry } from "../types/agent.interfaces";

export function createAgentContext(userId: string): AgentContext {
  return {
    tenantId: "phoenix-global",
    userId,
    traceId: randomUUID(),
    now: new Date().toISOString()
  };
}

export async function runAgentAnalyze(
  agentKey: keyof AgentRegistry,
  input: Record<string, unknown>,
  userId: string
) {
  const agent = getAgentByKey(agentKey);
  if (!agent) {
    throw new Error(`Agente desconhecido: ${agentKey}`);
  }
  const context = createAgentContext(userId);
  const decision = await agent.analyze(input, context);
  return { context, decision };
}

export async function runAgentFull(
  agentKey: keyof AgentRegistry,
  input: Record<string, unknown>,
  userId: string
) {
  const agent = getAgentByKey(agentKey);
  if (!agent) {
    throw new Error(`Agente desconhecido: ${agentKey}`);
  }
  const context = createAgentContext(userId);
  const decision = await agent.analyze(input, context);
  const result = await agent.execute(decision, context);
  return { context, decision, result };
}

export { defaultAgents };
