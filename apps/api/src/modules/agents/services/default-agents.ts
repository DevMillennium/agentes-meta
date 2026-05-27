import type { AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { AgentBase } from "../base/agent.base";

class SimpleAgent extends AgentBase<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>> {
  constructor(
    public readonly name: string,
    public readonly riskProfile: "low" | "medium" | "high",
    private readonly defaultActionType: string
  ) {
    super();
  }

  public async analyze(input: Record<string, unknown>): Promise<AgentDecision<Record<string, unknown>>> {
    const requiresApproval = this.riskProfile !== "low" || this.defaultActionType.includes("campaign");
    return {
      agentName: this.name,
      actionType: this.defaultActionType,
      riskLevel: this.riskProfile,
      reason: "Decisão inicial baseada em regras de MVP e guardrails.",
      payload: input,
      requiresApproval
    };
  }

  public async execute(decision: AgentDecision<Record<string, unknown>>): Promise<AgentExecutionResult<Record<string, unknown>>> {
    return {
      success: true,
      message: `${this.name} executou ${decision.actionType} em modo placeholder.`,
      data: decision.payload
    };
  }
}

export const defaultAgents = {
  marketingDirector: new SimpleAgent("MarketingDirectorAgent", "medium", "define_strategy"),
  paidTrafficStrategist: new SimpleAgent("PaidTrafficStrategistAgent", "high", "create_campaign_structure"),
  performanceAnalyst: new SimpleAgent("PerformanceAnalystAgent", "low", "analyze_campaign_performance"),
  adCopywriter: new SimpleAgent("AdCopywriterAgent", "low", "generate_ad_copy"),
  postCreator: new SimpleAgent("PostCreatorAgent", "low", "generate_content_posts"),
  metaCompliance: new SimpleAgent("MetaComplianceAgent", "high", "review_compliance_before_publish"),
  whatsappSales: new SimpleAgent("WhatsAppSalesAgent", "medium", "respond_whatsapp_lead"),
  instagramDirect: new SimpleAgent("InstagramDirectAgent", "medium", "respond_instagram_direct"),
  productManager: new SimpleAgent("ProductManagerAgent", "medium", "validate_product_stock"),
  crmFollowUp: new SimpleAgent("CRMFollowUpAgent", "low", "schedule_follow_up")
};
