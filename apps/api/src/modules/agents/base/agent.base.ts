import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { logger } from "../../../common/logger";
import type { IAgent } from "../types/agent.interfaces";

export abstract class AgentBase<Input = unknown, DecisionPayload = unknown, Result = unknown>
  implements IAgent<Input, DecisionPayload, Result> {
  public abstract readonly name: string;
  public abstract readonly riskProfile: "low" | "medium" | "high";

  public abstract analyze(input: Input, context: AgentContext): Promise<AgentDecision<DecisionPayload>>;
  public abstract execute(
    decision: AgentDecision<DecisionPayload>,
    context: AgentContext
  ): Promise<AgentExecutionResult<Result>>;

  protected log(action: string, context: AgentContext, metadata?: Record<string, unknown>): void {
    logger.info(
      {
        agent: this.name,
        action,
        traceId: context.traceId,
        tenantId: context.tenantId,
        userId: context.userId,
        metadata
      },
      "agent_action"
    );
  }
}
