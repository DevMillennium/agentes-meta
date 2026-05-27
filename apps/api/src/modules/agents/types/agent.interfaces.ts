import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";

export interface IAgent<Input = unknown, DecisionPayload = unknown, Result = unknown> {
  readonly name: string;
  readonly riskProfile: "low" | "medium" | "high";
  analyze(input: Input, context: AgentContext): Promise<AgentDecision<DecisionPayload>>;
  execute(decision: AgentDecision<DecisionPayload>, context: AgentContext): Promise<AgentExecutionResult<Result>>;
}

export interface AgentRegistry {
  marketingDirector: IAgent;
  paidTrafficStrategist: IAgent;
  performanceAnalyst: IAgent;
  adCopywriter: IAgent;
  postCreator: IAgent;
  metaCompliance: IAgent;
  whatsappSales: IAgent;
  instagramDirect: IAgent;
  productManager: IAgent;
  crmFollowUp: IAgent;
}
