import { logger } from "../../common/logger";
import { aiRoutingService, AiRoutingService } from "./ai-routing.service";
import { chatwootSyncService, ChatwootSyncService } from "./chatwoot-sync.service";
import { humanHandoffService, HumanHandoffService } from "./human-handoff.service";
import { metaOutboundService, MetaOutboundService } from "./meta-outbound.service";
import { normalizeMetaWebhook } from "./message-normalizer";
import type { NormalizedMessage } from "./types";

const log = logger.child({ module: "meta-webhook" });

export interface ProcessedMessageResult {
  platform: NormalizedMessage["platform"];
  messageId: string;
  chatwootConversationId?: number;
  autoReplied: boolean;
  handoff: boolean;
  reason: string;
}

/**
 * Orquestrador do webhook Meta (FASE 4–7).
 *
 * Fluxo por mensagem:
 *  1. Normaliza (já feito no controller).
 *  2. Sincroniza no Chatwoot (contato/conversa/mensagem).
 *  3. Decide auto-resposta com a AiRoutingService.
 *  4. Se precisar humano → HumanHandoffService.
 *  5. Se IA elegível → gera resposta, envia pelo canal Meta e registra como outgoing no Chatwoot.
 */
export class MetaWebhookService {
  constructor(
    private readonly sync: ChatwootSyncService = chatwootSyncService,
    private readonly routing: AiRoutingService = aiRoutingService,
    private readonly handoff: HumanHandoffService = humanHandoffService,
    private readonly outbound: MetaOutboundService = metaOutboundService
  ) {}

  public async processPayload(payload: unknown): Promise<ProcessedMessageResult[]> {
    const messages = normalizeMetaWebhook(payload);
    if (!messages.length) {
      log.debug("Webhook Meta sem mensagens normalizáveis.");
      return [];
    }

    const results: ProcessedMessageResult[] = [];
    for (const message of messages) {
      results.push(await this.processMessage(message));
    }
    return results;
  }

  public async processMessage(message: NormalizedMessage): Promise<ProcessedMessageResult> {
    const base: ProcessedMessageResult = {
      platform: message.platform,
      messageId: message.messageId,
      autoReplied: false,
      handoff: false,
      reason: "init"
    };

    // 2) Sincroniza no Chatwoot (se configurado).
    const synced = await this.sync.syncInbound(message);
    base.chatwootConversationId = synced.conversationId;

    // 3) Decide auto-resposta.
    const decision = this.routing.shouldAutoReply(
      { platform: message.platform, conversationId: synced.conversationId, humanHandoff: synced.humanHandoff },
      message
    );
    base.reason = decision.reason;

    // 4) Handoff humano.
    if (decision.requiresHuman) {
      base.handoff = true;
      if (synced.conversationId) {
        await this.handoff.requestHuman(
          { conversationId: synced.conversationId },
          `Sinal de necessidade de humano na mensagem do cliente (${message.platform}).`
        );
      }
      return base;
    }

    if (!decision.autoReply) {
      return base;
    }

    // 5) Gera e envia resposta IA.
    const reply = await this.routing.generateReply(
      { platform: message.platform, conversationId: synced.conversationId },
      message
    );

    const send = await this.outbound.sendText(message.platform, message.externalUserId, reply);
    base.autoReplied = send.ok;

    // Registra resposta como outgoing no Chatwoot (origem = bot, evita reenviar no webhook do Chatwoot).
    if (synced.conversationId) {
      await this.sync.recordOutgoing(synced.conversationId, reply, {
        automated: true,
        source: "ai-routing"
      });
    }

    base.reason = send.ok ? "auto-replied" : `send-failed:${send.error ?? "unknown"}`;
    return base;
  }
}

export const metaWebhookService = new MetaWebhookService();
