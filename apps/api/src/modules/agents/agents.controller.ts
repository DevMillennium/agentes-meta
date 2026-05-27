import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../common/security";
import { prisma } from "../../common/prisma";
import { AgentOrchestrator } from "./services/agent.orchestrator";
import { AGENT_CATALOG } from "./services/agent-catalog";
import { runAgentAnalyze, runAgentFull } from "./services/agent-runner.service";
import { defaultAgents } from "./services/default-agents";
import { enqueueAgentOrchestrationJob } from "../../queues/agent-jobs.queue";
import type { AgentRegistry } from "./types/agent.interfaces";

const orchestrator = new AgentOrchestrator(defaultAgents);

export const agentsRouter = Router();

agentsRouter.get("/", (_req, res) => {
  res.json({
    items: AGENT_CATALOG,
    total: AGENT_CATALOG.length
  });
});

agentsRouter.get("/actions", async (req, res) => {
  const agentName = typeof req.query.agentName === "string" ? req.query.agentName : undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const items = await prisma.agentAction.findMany({
    where: agentName ? { agentName } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit
  });

  res.json({ items, total: items.length });
});

const orchestrateSchema = z.object({
  objective: z.string().min(3).default("Vender produto prioritário"),
  maxDailyBudget: z.coerce.number().positive().default(50),
  productId: z.string().min(1),
  campaignType: z.enum(["traffic", "messages", "leads", "sales"]).default("messages")
});

agentsRouter.post("/orchestrate", async (req: AuthenticatedRequest, res) => {
  const parsed = orchestrateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.user?.userId ?? "system";
  const result = await orchestrator.runMarketingCycle(parsed.data, userId);

  await prisma.agentAction.create({
    data: {
      agentName: "AgentOrchestrator",
      actionType: "run_marketing_cycle",
      targetType: "campaign_flow",
      targetId: parsed.data.productId,
      reason: result.message,
      riskLevel: result.data && "pendingApproval" in (result.data as object) ? "MEDIUM" : "LOW",
      status: result.success ? "SUCCESS" : "BLOCKED",
      beforeData: parsed.data,
      afterData: result.data ? (result.data as object) : {}
    }
  });

  const pendingApproval = (
    result.data as
      | {
          pendingApproval?: {
            riskLevel: "low" | "medium" | "high";
            reason: string;
            payload: unknown;
            agentName: string;
          };
        }
      | undefined
  )?.pendingApproval;

  if (pendingApproval) {
    await prisma.approvalRequest.create({
      data: {
        title: `Aprovação requerida: ${pendingApproval.agentName}`,
        description: pendingApproval.reason,
        riskLevel: pendingApproval.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH",
        requestedBy: userId,
        requestedData: pendingApproval.payload as object
      }
    });
  }

  void enqueueAgentOrchestrationJob({
    traceId: String((result.data as { traceId?: string } | undefined)?.traceId ?? "not-provided"),
    productId: parsed.data.productId,
    objective: parsed.data.objective,
    riskLevel: result.data && "pendingApproval" in (result.data as object) ? "MEDIUM" : "LOW",
    requestedBy: userId
  });

  res.json(result);
});

agentsRouter.post("/:agentKey/analyze", async (req: AuthenticatedRequest, res) => {
  const agentKey = req.params.agentKey as keyof AgentRegistry;
  try {
    const output = await runAgentAnalyze(
      agentKey,
      (req.body ?? {}) as Record<string, unknown>,
      req.user?.userId ?? "system"
    );
    res.json(output);
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Falha ao analisar com agente."
    });
  }
});

agentsRouter.post("/:agentKey/run", async (req: AuthenticatedRequest, res) => {
  const agentKey = req.params.agentKey as keyof AgentRegistry;
  try {
    const output = await runAgentFull(
      agentKey,
      (req.body ?? {}) as Record<string, unknown>,
      req.user?.userId ?? "system"
    );

    await prisma.agentAction.create({
      data: {
        agentName: output.decision.agentName,
        actionType: output.decision.actionType,
        targetType: "agent_run",
        targetId: output.context.traceId,
        reason: output.result.message,
        riskLevel: output.decision.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH",
        status: output.result.success ? "SUCCESS" : "FAILED",
        beforeData: (req.body ?? {}) as object,
        afterData: (output.result.data ?? {}) as object
      }
    });

    res.json(output);
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Falha ao executar agente."
    });
  }
});
