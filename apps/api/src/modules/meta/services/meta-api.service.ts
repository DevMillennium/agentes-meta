import { env } from "../../../config/env";

export class MetaApiService {
  private readonly baseUrl = `https://graph.facebook.com/${env.META_API_VERSION}`;

  public async createCampaignPlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      ok: true,
      provider: "meta-marketing-api",
      baseUrl: this.baseUrl,
      action: "create_campaign",
      payload,
      note: "Placeholder: integração real será implementada na fase 2."
    };
  }

  public async fetchAdsInsightsPlaceholder(query: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      ok: true,
      provider: "meta-ads-insights-api",
      baseUrl: this.baseUrl,
      action: "get_insights",
      query,
      note: "Placeholder para diagnóstico e snapshots."
    };
  }

  public async sendInstagramMessagePlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      ok: true,
      provider: "instagram-messaging-api",
      baseUrl: this.baseUrl,
      action: "send_direct_message",
      payload
    };
  }

  public async sendWhatsAppMessagePlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      ok: true,
      provider: "whatsapp-cloud-api",
      baseUrl: this.baseUrl,
      action: "send_whatsapp_message",
      payload
    };
  }
}
