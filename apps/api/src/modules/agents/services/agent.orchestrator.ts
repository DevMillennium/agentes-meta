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

    if (!productDecision.payload || !(productDecision.payload as { valid?: boolean }).valid) {
      return {
        success: false,
        message: "Produto indisponível ou sem estoque.",
        data: { productDecision }
      };
    }

    const copyDecision = await this.registry.adCopywriter.analyze(
      { ...input, directorDecision: directorDecision.payload },
      context
    );

    const complianceDecision = await this.registry.metaCompliance.analyze(
      { copy: copyDecision.payload },
      context
    );

    if (complianceDecision.riskLevel === "high") {
      return {
        success: false,
        message: "Fluxo interrompido: MetaComplianceAgent bloqueou o conteúdo.",
        data: { complianceDecision, copyDecision }
      };
    }

    const postDecision = await this.registry.postCreator.analyze(input, context);

    const copyPayload = copyDecision.payload as { creativeId?: string };
    const trafficDecision = await this.registry.paidTrafficStrategist.analyze(
      {
        ...input,
        directorDecision: directorDecision.payload,
        productDecision: productDecision.payload,
        creativeId: copyPayload.creativeId,
        copyDecision: copyPayload,
        postDecision: postDecision.payload
      },
      context
    );

    const postResult = await this.registry.postCreator.execute(
      {
        agentName: "PostCreatorAgent",
        actionType: "generate_content_posts",
        riskLevel: "low",
        reason: "Publicação Instagram após compliance.",
        payload: postDecision.payload as { caption: string; hashtags: string[]; imageUrl: string },
        requiresApproval: false
      },
      context
    );

    const trafficResult = await this.executeWithApprovalGuard(
      this.registry.paidTrafficStrategist,
      trafficDecision,
      context
    );

    if (!trafficResult.success && !("pendingApproval" in (trafficResult.data as object))) {
      return trafficResult;
    }

    await this.registry.crmFollowUp.analyze(
      { ...input, campaignResult: trafficResult.data },
      context
    );

    return {
      success: true,
      message: "Ciclo de marketing concluído.",
      data: {
        traceId: context.traceId,
        directorDecision: directorDecision.payload,
        productDecision: productDecision.payload,
        copyDecision: copyDecision.payload,
        postDecision: postDecision.payload,
        postPublish: postResult.data,
        trafficResult
      }
    };
  }

  private async executeWithApprovalGuard(
    agent: IAgent,
    decision: Awaited<ReturnType<IAgent["analyze"]>>,
    context: AgentContext
  ): Promise<AgentExecutionResult> {
    if (decision.requiresApproval || decision.riskLevel === "high") {
      return {
        success: true,
        message: "Ação gerou solicitação de aprovação antes da execução.",
        data: {
          pendingApproval: {
            agentName: decision.agentName,
            riskLevel: decision.riskLevel,
            reason: decision.reason,
            payload: decision.payload
          }
        }
      };
    }

    return agent.execute(decision, context);
  }
}
