import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { AgentBase } from "../base/agent.base";

const BLOCKED_PATTERNS = [
  /\b(cura|milagre|100%\s*garantido|renda\s+extra\s+garantida)\b/i,
  /\b(rem[eé]dio\s+sem\s+receita|anabolizante)\b/i,
  /\b(golpe|fraude)\b/i
];

export class MetaComplianceAgent extends AgentBase<
  Record<string, unknown>,
  { approved: boolean; flags: string[]; copy: unknown },
  { approved: boolean }
> {
  public readonly name = "MetaComplianceAgent";
  public readonly riskProfile = "low" as const;

  public async analyze(
    input: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentDecision<{ approved: boolean; flags: string[]; copy: unknown }>> {
    const copyText = JSON.stringify(input.copy ?? input);
    const flags: string[] = [];

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(copyText)) {
        flags.push(`Padrão bloqueado: ${pattern.source}`);
      }
    }

    const approved = flags.length === 0;
    this.log("review_compliance", context, { approved, flagsCount: flags.length });

    return {
      agentName: this.name,
      actionType: "review_compliance_before_publish",
      riskLevel: approved ? "low" : "high",
      reason: approved
        ? "Conteúdo aprovado pelas regras de compliance Phoenix/Meta."
        : `Conteúdo bloqueado: ${flags.join("; ")}`,
      payload: { approved, flags, copy: input.copy },
      requiresApproval: !approved
    };
  }

  public async execute(
    decision: AgentDecision<{ approved: boolean; flags: string[]; copy: unknown }>,
    _context: AgentContext
  ): Promise<AgentExecutionResult<{ approved: boolean }>> {
    return {
      success: decision.payload.approved,
      message: decision.reason,
      data: { approved: decision.payload.approved }
    };
  }
}
