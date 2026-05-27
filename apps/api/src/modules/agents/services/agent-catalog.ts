import type { AgentRegistry } from "../types/agent.interfaces";
import { defaultAgents } from "./default-agents";

export interface AgentCatalogEntry {
  key: keyof AgentRegistry;
  name: string;
  riskProfile: string;
  description: string;
  capabilities: string[];
}

export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    key: "marketingDirector",
    name: "MarketingDirectorAgent",
    riskProfile: "medium",
    description: "Define estratégia e prioridades da operação de marketing.",
    capabilities: ["define_strategy"]
  },
  {
    key: "productManager",
    name: "ProductManagerAgent",
    riskProfile: "medium",
    description: "Valida estoque e disponibilidade de produtos.",
    capabilities: ["validate_product_stock"]
  },
  {
    key: "adCopywriter",
    name: "AdCopywriterAgent",
    riskProfile: "low",
    description: "Gera copy e salva criativos no banco.",
    capabilities: ["generate_ad_copy"]
  },
  {
    key: "metaCompliance",
    name: "MetaComplianceAgent",
    riskProfile: "low",
    description: "Revisa compliance antes de publicar.",
    capabilities: ["review_compliance_before_publish"]
  },
  {
    key: "postCreator",
    name: "PostCreatorAgent",
    riskProfile: "low",
    description: "Cria e publica posts no Instagram.",
    capabilities: ["generate_content_posts", "publish_instagram"]
  },
  {
    key: "paidTrafficStrategist",
    name: "PaidTrafficStrategistAgent",
    riskProfile: "high",
    description: "Cria campanhas no Postgres e na Meta Ads.",
    capabilities: ["create_campaign_structure"]
  },
  {
    key: "whatsappSales",
    name: "WhatsAppSalesAgent",
    riskProfile: "medium",
    description: "Responde leads no WhatsApp com IA.",
    capabilities: ["respond_message", "respond_with_handoff"]
  },
  {
    key: "instagramDirect",
    name: "InstagramDirectAgent",
    riskProfile: "medium",
    description: "Responde Direct no Instagram com IA.",
    capabilities: ["respond_message", "respond_with_handoff"]
  },
  {
    key: "performanceAnalyst",
    name: "PerformanceAnalystAgent",
    riskProfile: "low",
    description: "Analisa performance de campanhas.",
    capabilities: ["analyze_campaign_performance"]
  },
  {
    key: "crmFollowUp",
    name: "CRMFollowUpAgent",
    riskProfile: "low",
    description: "Agenda follow-up de leads.",
    capabilities: ["schedule_follow_up"]
  }
];

export function getAgentByKey(key: string): AgentRegistry[keyof AgentRegistry] | null {
  if (key in defaultAgents) {
    return defaultAgents[key as keyof AgentRegistry];
  }
  return null;
}
