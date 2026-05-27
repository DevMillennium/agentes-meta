import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { AgentBase } from "../base/agent.base";

/** Agente leve para direção de marketing e CRM sem chamadas externas pesadas. */
export class SimpleStrategyAgent extends AgentBase<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
> {
  constructor(
    public readonly name: string,
    public readonly riskProfile: "low" | "medium",
    private readonly actionType: string
  ) {
    super();
  }

  public async analyze(
    input: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentDecision<Record<string, unknown>>> {
    this.log(this.actionType, context);
    return {
      agentName: this.name,
      actionType: this.actionType,
      riskLevel: this.riskProfile,
      reason: `${this.name} concluiu análise.`,
      payload: input,
      requiresApproval: false
    };
  }

  public async execute(
    decision: AgentDecision<Record<string, unknown>>
  ): Promise<AgentExecutionResult<Record<string, unknown>>> {
    return {
      success: true,
      message: `${this.name} executou ${decision.actionType}.`,
      data: decision.payload
    };
  }
}
