export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  stockLocation?: string;
  minMargin?: number;
}

export interface CampaignGuardrails {
  maxDailyBudget: number;
  requireApprovalForBudgetChanges: boolean;
  neverDeleteCampaigns: boolean;
}

export interface LeadIntent {
  leadId: string;
  source: "whatsapp" | "instagram" | "other";
  temperature: "cold" | "warm" | "hot";
  nextAction: string;
}
