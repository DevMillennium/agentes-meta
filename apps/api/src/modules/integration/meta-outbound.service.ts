import { logger } from "../../common/logger";
import { MetaApiService } from "../meta/services/meta-api.service";
import type { MetaSendResult } from "../meta/services/meta-send.types";
import type { NormalizedPlatform } from "./types";

const log = logger.child({ module: "meta-outbound" });

/**
 * Despacha mensagens de saída pelo canal Meta correto a partir da plataforma
 * normalizada. Centraliza o mapeamento plataforma → método do Graph API.
 */
export class MetaOutboundService {
  constructor(private readonly metaApi: MetaApiService = new MetaApiService()) {}

  public async sendText(
    platform: NormalizedPlatform,
    recipientId: string,
    text: string
  ): Promise<MetaSendResult> {
    log.info({ platform, recipientId }, "Enviando mensagem de saída via Meta.");
    switch (platform) {
      case "whatsapp":
        return this.metaApi.sendWhatsAppTextMessage(recipientId, text);
      case "instagram":
        return this.metaApi.sendInstagramTextMessage(recipientId, text);
      case "facebook":
        return this.metaApi.sendMessengerTextMessage(recipientId, text);
      default:
        return {
          ok: false,
          mode: "graph",
          provider: "meta-outbound",
          error: `Plataforma não suportada: ${platform as string}`
        };
    }
  }
}

export const metaOutboundService = new MetaOutboundService();
