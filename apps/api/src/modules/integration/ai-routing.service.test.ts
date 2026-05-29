import { describe, expect, it } from "vitest";
import { aiRoutingService } from "./ai-routing.service";
import type { NormalizedMessage } from "./types";

const baseMessage: NormalizedMessage = {
  platform: "instagram",
  externalUserId: "u1",
  externalConversationId: "c1",
  messageId: "m1",
  messageType: "text",
  text: "Qual o preço do iPhone?",
  attachments: [],
  timestamp: new Date().toISOString(),
  rawPayload: {}
};

describe("AiRoutingService", () => {
  it("não responde quando handoff humano está ativo", () => {
    const decision = aiRoutingService.shouldAutoReply(
      { platform: "instagram", humanHandoff: true },
      baseMessage
    );
    expect(decision.autoReply).toBe(false);
    expect(decision.reason).toBe("human-handoff-active");
  });

  it("detecta intenção de falar com humano", () => {
    const decision = aiRoutingService.shouldAutoReply(
      { platform: "instagram" },
      { ...baseMessage, text: "Quero falar com um atendente humano" }
    );
    expect(decision.autoReply).toBe(false);
    expect(decision.requiresHuman).toBe(true);
  });

  it("permite auto-resposta em mensagem de texto comum", () => {
    const decision = aiRoutingService.shouldAutoReply({ platform: "instagram" }, baseMessage);
    expect(decision.autoReply).toBe(true);
  });
});
