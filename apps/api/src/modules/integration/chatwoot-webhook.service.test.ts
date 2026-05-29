import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChatwootWebhookService } from "./chatwoot-webhook.service";
import type { MetaOutboundService } from "./meta-outbound.service";

describe("ChatwootWebhookService", () => {
  const outbound = {
    sendText: vi.fn()
  } as unknown as MetaOutboundService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CHATWOOT_INBOX_ID_INSTAGRAM = "10";
    process.env.CHATWOOT_INBOX_ID_FACEBOOK = "20";
    process.env.CHATWOOT_INBOX_ID_WHATSAPP = "30";
  });

  it("ignora message_created incoming", async () => {
    const svc = new ChatwootWebhookService(outbound);
    const result = await svc.process({
      event: "message_created",
      message_type: 0,
      content: "oi"
    });
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("not-outgoing");
    expect(outbound.sendText).not.toHaveBeenCalled();
  });

  it("ignora mensagens automatizadas (anti-loop IA)", async () => {
    const svc = new ChatwootWebhookService(outbound);
    const result = await svc.process({
      event: "message_created",
      message_type: 1,
      content: "Resposta da IA",
      content_attributes: { automated: true, source: "ai-routing" }
    });
    expect(result.reason).toBe("automated-echo");
    expect(outbound.sendText).not.toHaveBeenCalled();
  });

  it("reenvia mensagem outgoing humana para Instagram", async () => {
    (outbound.sendText as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      mode: "graph",
      provider: "instagram-messaging-api"
    });

    const svc = new ChatwootWebhookService(outbound);
    const result = await svc.process({
      event: "message_created",
      message_type: "outgoing",
      content: "Olá, sou o atendente!",
      conversation: {
        inbox_id: 10,
        additional_attributes: { platform: "instagram" },
        contact_inbox: { source_id: "ig_user_99" }
      }
    });

    expect(result.handled).toBe(true);
    expect(result.delivered).toBe(true);
    expect(outbound.sendText).toHaveBeenCalledWith("instagram", "ig_user_99", "Olá, sou o atendente!");
  });
});
