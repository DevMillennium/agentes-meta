import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { generateJsonCompletion } from "../../ai/openai.service";
import { AgentBase } from "../base/agent.base";
interface OrchestrationInput {
  objective: string;
  maxDailyBudget: number;
  productId: string;
  campaignType: "traffic" | "messages" | "leads" | "sales";
}

interface StrategyPayload {
  objective: string;
  focusChannels: string[];
  tone: string;
  priorityActions: string[];
  budgetHint: number;
}

export class MarketingDirectorAgent extends AgentBase<
  OrchestrationInput,
  StrategyPayload,
  StrategyPayload
> {
  public readonly name = "MarketingDirectorAgent";
  public readonly riskProfile = "medium" as const;

  public async analyze(
    input: OrchestrationInput,
    context: AgentContext
  ): Promise<AgentDecision<StrategyPayload>> {
    this.log("define_strategy", context);

    const ai = await generateJsonCompletion<StrategyPayload>(
      `Você é diretor de marketing da Phoenix Global Imports (eletrônicos, Fortaleza).
Retorne JSON: objective, focusChannels (array), tone, priorityActions (array), budgetHint (number).`,
      `Objetivo: ${input.objective}. Orçamento diário máx: R$ ${input.maxDailyBudget}. Tipo campanha: ${input.campaignType}. Produto ID: ${input.productId}.`
    );

    const payload: StrategyPayload = ai ?? {
      objective: input.objective,
      focusChannels: ["whatsapp", "instagram", "meta_ads"],
      tone: "profissional e direto",
      priorityActions: [
        "Validar estoque do produto",
        "Gerar criativos e copy",
        "Publicar no Instagram",
        `Campanha Meta tipo ${input.campaignType}`
      ],
      budgetHint: input.maxDailyBudget
    };

    return {
      agentName: this.name,
      actionType: "define_strategy",
      riskLevel: "medium",
      reason: ai ? "Estratégia gerada com IA." : "Estratégia padrão (IA offline).",
      payload,
      requiresApproval: false
    };
  }

  public async execute(
    decision: AgentDecision<StrategyPayload>
  ): Promise<AgentExecutionResult<StrategyPayload>> {
    return {
      success: true,
      message: "Estratégia registrada.",
      data: decision.payload
    };
  }
}
