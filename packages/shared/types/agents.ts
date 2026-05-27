export type AgentRiskLevel = "low" | "medium" | "high";

export interface AgentContext {
  tenantId: string;
  userId: string;
  traceId: string;
  now: string;
}

export interface AgentDecision<TPayload = unknown> {
  agentName: string;
  actionType: string;
  riskLevel: AgentRiskLevel;
  reason: string;
  payload: TPayload;
  requiresApproval: boolean;
}

export interface AgentExecutionResult<TData = unknown> {
  success: boolean;
  message: string;
  data?: TData;
}
