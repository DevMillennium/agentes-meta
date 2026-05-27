import { env } from "../../../config/env";
import { MetaGraphRequestError, postMetaGraphJson } from "./meta-graph.client";
import type { MetaSendResult } from "./meta-send.types";

export class MetaApiService {
  private readonly baseUrl = `https://graph.facebook.com/${env.META_API_VERSION}`;

  private isWhatsAppGraphReady(): boolean {
    return Boolean(env.META_ACCESS_TOKEN?.trim() && env.WHATSAPP_PHONE_NUMBER_ID?.trim());
  }

  private isInstagramGraphReady(): boolean {
    return Boolean(env.META_ACCESS_TOKEN?.trim() && env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim());
  }

  private normalizeWhatsAppTo(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  /**
   * Envio real via WhatsApp Cloud API quando `META_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` estão definidos.
   * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
   */
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

    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID.trim();
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

  /**
   * Envio real via Instagram Messaging API quando `META_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID` estão definidos.
   * @see https://developers.facebook.com/docs/instagram-platform/instagram-messaging
   */
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

    const igUserId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID.trim();
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

  /** @deprecated Prefira `sendInstagramTextMessage` — mantido para compatibilidade. */
  public async sendInstagramMessagePlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const recipientId = String(payload.recipient ?? "");
    const text = String(payload.text ?? "");
    const result = await this.sendInstagramTextMessage(recipientId, text);
    return { ...result };
  }

  /** @deprecated Prefira `sendWhatsAppTextMessage` — mantido para compatibilidade. */
  public async sendWhatsAppMessagePlaceholder(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const to = String(payload.to ?? "");
    const text = String(payload.text ?? "");
    const result = await this.sendWhatsAppTextMessage(to, text);
    return { ...result };
  }
}
