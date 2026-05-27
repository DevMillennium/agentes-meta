import type { AgentContext, AgentExecutionResult } from "@phoenix/shared";
import { randomUUID } from "node:crypto";
import type { AgentRegistry, IAgent } from "../types/agent.interfaces";

export interface OrchestrationInput {
  objective: string;
  maxDailyBudget: number;
  productId: string;
  campaignType: "traffic" | "messages" | "leads" | "sales";
}

export class AgentOrchestrator {
  constructor(private readonly registry: AgentRegistry) {}

  public async runMarketingCycle(input: OrchestrationInput, userId = "system"): Promise<AgentExecutionResult> {
    const context: AgentContext = {
      tenantId: "phoenix-global",
      userId,
      traceId: randomUUID(),
      now: new Date().toISOString()
    };

    const directorDecision = await this.registry.marketingDirector.analyze(input, context);
    const productDecision = await this.registry.productManager.analyze(input, context);
    const copyDecision = await this.registry.adCopywriter.analyze(input, context);
    const complianceDecision = await this.registry.metaCompliance.analyze(
      { ...input, copy: copyDecision.payload },
      context
    );

    if (complianceDecision.riskLevel === "high") {
      return {
        success: false,
        message: "Fluxo interrompido: MetaComplianceAgent bloqueou a publicação.",
        data: { complianceDecision }
      };
    }

    const trafficDecision = await this.registry.paidTrafficStrategist.analyze(
      { ...input, directorDecision, productDecision, copyDecision },
      context
    );

    return this.executeWithApprovalGuard(this.registry.paidTrafficStrategist, trafficDecision, context);
  }

  private async executeWithApprovalGuard(
    agent: IAgent,
    decision: Awaited<ReturnType<IAgent["analyze"]>>,
    context: AgentContext
  ): Promise<AgentExecutionResult> {
    if (decision.requiresApproval || decision.riskLevel !== "low") {
      return {
        success: true,
        message: "Ação gerou solicitação de aprovação antes da execução.",
        data: { pendingApproval: decision }
      };
    }

    return agent.execute(decision, context);
  }
}
