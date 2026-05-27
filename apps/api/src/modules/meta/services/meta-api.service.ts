import { env, getMetaAccessToken } from "../../../config/env";
import { getEffectiveMetaIds } from "../../../config/meta-runtime";
import {
  getMetaGraphJson,
  MetaGraphRequestError,
  postMetaGraphJson
} from "./meta-graph.client";
import type { MetaSendResult } from "./meta-send.types";

export interface MetaApiResult<T = unknown> {
  ok: boolean;
  mode: "graph" | "placeholder";
  provider: string;
  data?: T;
  error?: string;
  status?: number;
  meta?: unknown;
  note?: string;
}

export interface CreateCampaignInput {
  adAccountId: string;
  name: string;
  objective?: string;
  status?: "PAUSED" | "ACTIVE";
  specialAdCategories?: string[];
}

export interface FetchInsightsInput {
  objectId: string;
  fields?: string;
  datePreset?: string;
  timeRange?: { since: string; until: string };
  breakdowns?: string;
}

export class MetaApiService {
  private readonly baseUrl = `https://graph.facebook.com/${env.META_API_VERSION}`;

  public hasAccessToken(): boolean {
    return Boolean(getMetaAccessToken());
  }

  private metaIds() {
    return getEffectiveMetaIds();
  }

  private isWhatsAppGraphReady(): boolean {
    return Boolean(getMetaAccessToken() && this.metaIds().whatsappPhoneNumberId);
  }

  private isInstagramGraphReady(): boolean {
    return Boolean(getMetaAccessToken() && this.metaIds().instagramBusinessAccountId);
  }

  private normalizeWhatsAppTo(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private normalizeAdAccountId(adAccountId: string): string {
    const trimmed = adAccountId.trim();
    if (trimmed.startsWith("act_")) return trimmed;
    return `act_${trimmed.replace(/^act_/, "")}`;
  }

  public async listAdAccounts(): Promise<MetaApiResult<{ data: unknown[] }>> {
    if (!this.hasAccessToken()) {
      return {
        ok: false,
        mode: "placeholder",
        provider: "meta-marketing-api",
        note: "Conecte via GET /api/meta/oauth/login"
      };
    }

    try {
      const data = await getMetaGraphJson<{ data: unknown[] }>(`${this.baseUrl}/me/adaccounts`, {
        fields: "id,name,account_status,currency,timezone_name,amount_spent,balance"
      });
      return { ok: true, mode: "graph", provider: "meta-marketing-api", data };
    } catch (error) {
      return this.toErrorResult<{ data: unknown[] }>("meta-marketing-api", error);
    }
  }

  public async getMe(): Promise<MetaApiResult<Record<string, unknown>>> {
    if (!this.hasAccessToken()) {
      return {
        ok: false,
        mode: "placeholder",
        provider: "meta-graph-api",
        note: "Token ausente."
      };
    }

    try {
      const data = await getMetaGraphJson<Record<string, unknown>>(`${this.baseUrl}/me`, {
        fields: "id,name"
      });
      return { ok: true, mode: "graph", provider: "meta-graph-api", data };
    } catch (error) {
      return this.toErrorResult<Record<string, unknown>>("meta-graph-api", error);
    }
  }

  public async createCampaign(input: CreateCampaignInput): Promise<MetaApiResult<Record<string, unknown>>> {
    if (!this.hasAccessToken()) {
      const placeholder = await this.createCampaignPlaceholder(input as unknown as Record<string, unknown>);
      return {
        ok: Boolean(placeholder.ok),
        mode: "placeholder",
        provider: "meta-marketing-api",
        data: placeholder as Record<string, unknown>,
        note: String(placeholder.note ?? "Token ausente")
      };
    }

    const actId = this.normalizeAdAccountId(input.adAccountId);
    const url = `${this.baseUrl}/${actId}/campaigns`;
    const body = {
      name: input.name,
      objective: input.objective ?? "OUTCOME_ENGAGEMENT",
      status: input.status ?? "PAUSED",
      special_ad_categories: input.specialAdCategories ?? []
    };

    try {
      const data = await postMetaGraphJson<Record<string, unknown>>(url, body);
      return { ok: true, mode: "graph", provider: "meta-marketing-api", data };
    } catch (error) {
      return this.toErrorResult<Record<string, unknown>>("meta-marketing-api", error);
    }
  }

  public async fetchAdsInsights(input: FetchInsightsInput): Promise<MetaApiResult<{ data: unknown[] }>> {
    if (!this.hasAccessToken()) {
      return {
        ok: false,
        mode: "placeholder",
        provider: "meta-ads-insights-api",
        note: "Token ausente — use OAuth.",
        data: { data: [] } as unknown as { data: unknown[] }
      };
    }

    const objectId = input.objectId.trim();
    const params: Record<string, string> = {
      fields:
        input.fields ??
        "impressions,reach,spend,clicks,cpc,ctr,cpm,actions,cost_per_action_type,frequency"
    };

    if (input.datePreset) params.date_preset = input.datePreset;
    if (input.timeRange) params.time_range = JSON.stringify(input.timeRange);
    if (input.breakdowns) params.breakdowns = input.breakdowns;

    try {
      const data = await getMetaGraphJson<{ data: unknown[] }>(
        `${this.baseUrl}/${encodeURIComponent(objectId)}/insights`,
        params
      );
      return { ok: true, mode: "graph", provider: "meta-ads-insights-api", data };
    } catch (error) {
      return this.toErrorResult<{ data: unknown[] }>("meta-ads-insights-api", error);
    }
  }

  public async sendWhatsAppTextMessage(to: string, text: string): Promise<MetaSendResult> {
    if (!this.isWhatsAppGraphReady()) {
      return {
        ok: true,
        mode: "placeholder",
        provider: "whatsapp-cloud-api",
        note: "Defina META_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID para ativar envio real.",
        raw: { to, text }
      };
    }

    const waTo = this.normalizeWhatsAppTo(to);
    if (!waTo) {
      return {
        ok: false,
        mode: "graph",
        provider: "whatsapp-cloud-api",
        error: "Destino WhatsApp inválido (sem dígitos no número)."
      };
    }

    const phoneNumberId = this.metaIds().whatsappPhoneNumberId!.trim();
    const url = `${this.baseUrl}/${encodeURIComponent(phoneNumberId)}/messages`;
    const body = {
      messaging_product: "whatsapp",
      to: waTo,
      type: "text",
      text: { preview_url: false, body: text }
    };

    try {
      const data = await postMetaGraphJson<Record<string, unknown>>(url, body);
      const messages = Array.isArray(data.messages) ? data.messages : [];
      const first = messages[0] as { id?: string } | undefined;
      const graphMessageId = typeof first?.id === "string" ? first.id : undefined;
      return {
        ok: true,
        mode: "graph",
        provider: "whatsapp-cloud-api",
        graphMessageId,
        raw: data
      };
    } catch (error) {
      if (error instanceof MetaGraphRequestError) {
        return {
          ok: false,
          mode: "graph",
          provider: "whatsapp-cloud-api",
          error: error.message,
          status: error.status,
          meta: error.payload
        };
      }
      return {
        ok: false,
        mode: "graph",
        provider: "whatsapp-cloud-api",
        error: error instanceof Error ? error.message : "Erro desconhecido ao enviar WhatsApp."
      };
    }
  }

  public async sendInstagramTextMessage(recipientId: string, text: string): Promise<MetaSendResult> {
    if (!this.isInstagramGraphReady()) {
      return {
        ok: true,
        mode: "placeholder",
        provider: "instagram-messaging-api",
        note: "Defina META_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID para ativar envio real.",
        raw: { recipientId, text }
      };
    }

    const igUserId = this.metaIds().instagramBusinessAccountId!.trim();
    const url = `${this.baseUrl}/${encodeURIComponent(igUserId)}/messages`;
    const body = {
      recipient: { id: recipientId },
      message: { text }
    };

    try {
      const data = await postMetaGraphJson<Record<string, unknown>>(url, body);
      const graphMessageId =
        typeof data.message_id === "string"
          ? data.message_id
          : typeof (data as { id?: string }).id === "string"
            ? (data as { id: string }).id
            : undefined;
      return {
        ok: true,
        mode: "graph",
        provider: "instagram-messaging-api",
        graphMessageId,
        raw: data
      };
    } catch (error) {
      if (error instanceof MetaGraphRequestError) {
        return {
          ok: false,
          mode: "graph",
          provider: "instagram-messaging-api",
          error: error.message,
          status: error.status,
          meta: error.payload
        };
      }
      return {
        ok: false,
        mode: "graph",
        provider: "instagram-messaging-api",
        error: error instanceof Error ? error.message : "Erro desconhecido ao enviar Instagram Direct."
      };
    }
  }

  /** Compatibilidade — delega para `createCampaign`. */
  public async createCampaignPlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const adAccountId = String(payload.adAccountId ?? env.META_AD_ACCOUNT_ID ?? "");
    if (!adAccountId) {
      return {
        ok: false,
        provider: "meta-marketing-api",
        note: "Informe adAccountId ou META_AD_ACCOUNT_ID no .env",
        payload
      };
    }

    const result = await this.createCampaign({
      adAccountId,
      name: String(payload.name ?? "Phoenix Campaign"),
      objective: payload.objective ? String(payload.objective) : undefined,
      status: (payload.status as "PAUSED" | "ACTIVE") ?? "PAUSED"
    });

    return { ...result, action: "create_campaign", payload };
  }

  /** Compatibilidade — delega para `fetchAdsInsights`. */
  public async fetchAdsInsightsPlaceholder(query: Record<string, unknown>): Promise<Record<string, unknown>> {
    const objectId = String(query.objectId ?? query.campaignId ?? query.adAccountId ?? env.META_AD_ACCOUNT_ID ?? "");
    if (!objectId) {
      return {
        ok: false,
        provider: "meta-ads-insights-api",
        note: "Informe objectId, campaignId ou META_AD_ACCOUNT_ID",
        query
      };
    }

    const result = await this.fetchAdsInsights({
      objectId,
      fields: query.fields ? String(query.fields) : undefined,
      datePreset: query.datePreset ? String(query.datePreset) : "last_7d",
      breakdowns: query.breakdowns ? String(query.breakdowns) : undefined
    });

    return { ...result, action: "get_insights", query };
  }

  public async sendInstagramMessagePlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const recipientId = String(payload.recipient ?? "");
    const text = String(payload.text ?? "");
    const result = await this.sendInstagramTextMessage(recipientId, text);
    return { ...result };
  }

  public async createAdCreative(input: {
    adAccountId: string;
    name: string;
    title: string;
    body: string;
    linkUrl?: string;
    imageUrl?: string;
    pageId?: string;
  }): Promise<MetaApiResult<Record<string, unknown>>> {
    if (!this.hasAccessToken()) {
      return { ok: false, mode: "placeholder", provider: "meta-ad-creative", note: "Token ausente." };
    }

    const pageId = input.pageId ?? this.metaIds().pageId;
    if (!pageId) {
      return {
        ok: false,
        mode: "graph",
        provider: "meta-ad-creative",
        error: "META_PAGE_ID ausente. Rode POST /api/meta/sync-assets."
      };
    }

    const actId = this.normalizeAdAccountId(input.adAccountId);
    const linkData: Record<string, unknown> = {
      message: input.body,
      link: input.linkUrl ?? "https://www.instagram.com/globalholdingphoenix/",
      name: input.title,
      call_to_action: { type: "LEARN_MORE" }
    };
    if (input.imageUrl) {
      linkData.picture = input.imageUrl;
    }

    try {
      const data = await postMetaGraphJson<Record<string, unknown>>(
        `${this.baseUrl}/${actId}/adcreatives`,
        {
          name: input.name,
          object_story_spec: {
            page_id: pageId,
            link_data: linkData
          }
        }
      );
      return { ok: true, mode: "graph", provider: "meta-ad-creative", data };
    } catch (error) {
      return this.toErrorResult<Record<string, unknown>>("meta-ad-creative", error);
    }
  }

  public async createAdSet(input: {
    adAccountId: string;
    campaignId: string;
    name: string;
    dailyBudget: number;
    status?: "PAUSED" | "ACTIVE";
  }): Promise<MetaApiResult<Record<string, unknown>>> {
    if (!this.hasAccessToken()) {
      return { ok: false, mode: "placeholder", provider: "meta-ad-set", note: "Token ausente." };
    }

    const actId = this.normalizeAdAccountId(input.adAccountId);
    const dailyBudgetCents = Math.round(input.dailyBudget * 100);

    try {
      const data = await postMetaGraphJson<Record<string, unknown>>(
        `${this.baseUrl}/${actId}/adsets`,
        {
          name: input.name,
          campaign_id: input.campaignId,
          daily_budget: dailyBudgetCents,
          billing_event: "IMPRESSIONS",
          optimization_goal: "REACH",
          bid_amount: 200,
          targeting: { geo_locations: { countries: ["BR"] }, age_min: 18, age_max: 55 },
          status: input.status ?? "PAUSED"
        }
      );
      return { ok: true, mode: "graph", provider: "meta-ad-set", data };
    } catch (error) {
      return this.toErrorResult<Record<string, unknown>>("meta-ad-set", error);
    }
  }

  public async createAd(input: {
    adAccountId: string;
    adSetId: string;
    creativeId: string;
    name: string;
    status?: "PAUSED" | "ACTIVE";
  }): Promise<MetaApiResult<Record<string, unknown>>> {
    if (!this.hasAccessToken()) {
      return { ok: false, mode: "placeholder", provider: "meta-ad", note: "Token ausente." };
    }

    const actId = this.normalizeAdAccountId(input.adAccountId);

    try {
      const data = await postMetaGraphJson<Record<string, unknown>>(
        `${this.baseUrl}/${actId}/ads`,
        {
          name: input.name,
          adset_id: input.adSetId,
          creative: { creative_id: input.creativeId },
          status: input.status ?? "PAUSED"
        }
      );
      return { ok: true, mode: "graph", provider: "meta-ad", data };
    } catch (error) {
      return this.toErrorResult<Record<string, unknown>>("meta-ad", error);
    }
  }

  public async publishInstagramPost(input: {
    caption: string;
    imageUrl: string;
  }): Promise<MetaApiResult<{ id?: string }>> {
    const igId = this.metaIds().instagramBusinessAccountId;
    if (!this.hasAccessToken() || !igId) {
      return {
        ok: false,
        mode: "placeholder",
        provider: "instagram-content-publishing",
        note: "Token ou INSTAGRAM_BUSINESS_ACCOUNT_ID ausente."
      };
    }

    try {
      const container = await postMetaGraphJson<{ id?: string }>(
        `${this.baseUrl}/${igId}/media`,
        {
          image_url: input.imageUrl,
          caption: input.caption
        }
      );
      if (!container.id) {
        return {
          ok: false,
          mode: "graph",
          provider: "instagram-content-publishing",
          error: "Container de mídia não retornou id."
        };
      }

      const published = await postMetaGraphJson<{ id?: string }>(
        `${this.baseUrl}/${igId}/media_publish`,
        { creation_id: container.id }
      );

      return {
        ok: true,
        mode: "graph",
        provider: "instagram-content-publishing",
        data: published
      };
    } catch (error) {
      return this.toErrorResult<{ id?: string }>("instagram-content-publishing", error);
    }
  }

  public async sendWhatsAppMessagePlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const to = String(payload.to ?? "");
    const text = String(payload.text ?? "");
    const result = await this.sendWhatsAppTextMessage(to, text);
    return { ...result };
  }

  private toErrorResult<T>(provider: string, error: unknown): MetaApiResult<T> {
    if (error instanceof MetaGraphRequestError) {
      return {
        ok: false,
        mode: "graph",
        provider,
        error: error.message,
        status: error.status,
        meta: error.payload
      };
    }
    return {
      ok: false,
      mode: "graph",
      provider,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    };
  }
}
