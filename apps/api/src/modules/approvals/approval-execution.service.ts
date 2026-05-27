import type { ApprovalRequest } from "@prisma/client";
import { prisma } from "../../common/prisma";
import { defaultAgents } from "../agents/services/default-agents";
import { AgentOrchestrator } from "../agents/services/agent.orchestrator";

const orchestrator = new AgentOrchestrator(defaultAgents);

export async function executeApprovedRequest(approval: ApprovalRequest): Promise<Record<string, unknown>> {
  const data = (approval.requestedData ?? {}) as Record<string, unknown>;
  const agentName = String(data.agentName ?? "");

  if (agentName === "PaidTrafficStrategistAgent" && data.payload) {
    const decision = {
      agentName,
      actionType: "create_campaign_structure",
      riskLevel: "medium" as const,
      reason: "Execução pós-aprovação humana.",
      payload: data.payload as Record<string, unknown>,
      requiresApproval: false
    };

    const result = await defaultAgents.paidTrafficStrategist.execute(decision, {
      tenantId: "phoenix-global",
      userId: approval.decidedById ?? "approval-system",
      traceId: `approval-${approval.id}`,
      now: new Date().toISOString()
    });

    await prisma.agentAction.create({
      data: {
        agentName,
        actionType: "execute_after_approval",
        targetType: "approval_request",
        targetId: approval.id,
        reason: result.message,
        riskLevel: "MEDIUM",
        status: result.success ? "SUCCESS" : "FAILED",
        afterData: (result.data ?? {}) as object
      }
    });

    return { type: "paid_traffic", result };
  }

  if (data.objective && data.productId) {
    const result = await orchestrator.runMarketingCycle(
      {
        objective: String(data.objective),
        maxDailyBudget: Number(data.maxDailyBudget ?? 50),
        productId: String(data.productId),
        campaignType: (data.campaignType as "messages") ?? "messages"
      },
      approval.decidedById ?? "approval-system"
    );
    return { type: "marketing_cycle", result };
  }

  return { type: "noop", message: "Nenhuma ação executável mapeada para esta aprovação." };
}
