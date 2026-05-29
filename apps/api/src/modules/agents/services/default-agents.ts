import { AdCopywriterAgent } from "../implementations/ad-copywriter.agent";
import { MessagingSalesAgent } from "../implementations/messaging.agent";
import { MetaComplianceAgent } from "../implementations/meta-compliance.agent";
import { PaidTrafficStrategistAgent } from "../implementations/paid-traffic.agent";
import { PostCreatorAgent } from "../implementations/post-creator.agent";
import { ProductManagerAgent } from "../implementations/product-manager.agent";
import { MarketingDirectorAgent } from "../implementations/marketing-director.agent";
import { SimpleStrategyAgent } from "../implementations/simple-strategy.agent";
import type { AgentRegistry } from "../types/agent.interfaces";

export const defaultAgents: AgentRegistry = {
  marketingDirector: new MarketingDirectorAgent(),
  paidTrafficStrategist: new PaidTrafficStrategistAgent(),
  performanceAnalyst: new SimpleStrategyAgent("PerformanceAnalystAgent", "low", "analyze_campaign_performance"),
  adCopywriter: new AdCopywriterAgent(),
  postCreator: new PostCreatorAgent(),
  metaCompliance: new MetaComplianceAgent(),
  whatsappSales: new MessagingSalesAgent("WhatsAppSalesAgent"),
  instagramDirect: new MessagingSalesAgent("InstagramDirectAgent"),
  productManager: new ProductManagerAgent(),
  crmFollowUp: new SimpleStrategyAgent("CRMFollowUpAgent", "low", "schedule_follow_up")
};
