import { describe, expect, it } from "vitest";
import { normalizeMetaWebhook } from "./message-normalizer";

describe("normalizeMetaWebhook", () => {
  it("normaliza WhatsApp Cloud API", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "123456789" },
                contacts: [{ wa_id: "5585999999999", profile: { name: "Maria" } }],
                messages: [
                  {
                    from: "5585999999999",
                    id: "wamid.ABC123",
                    timestamp: "1710000000",
                    type: "text",
                    text: { body: "Quero comprar" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const messages = normalizeMetaWebhook(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      platform: "whatsapp",
      externalUserId: "5585999999999",
      messageId: "wamid.ABC123",
      messageType: "text",
      text: "Quero comprar",
      senderName: "Maria"
    });
  });

  it("normaliza Instagram Direct (object instagram)", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841405786843323",
          messaging: [
            {
              sender: { id: "ig_user_99" },
              recipient: { id: "17841405786843323" },
              timestamp: 1710000000000,
              message: { mid: "mid.ig.99", text: "Tem AirPods?" }
            }
          ]
        }
      ]
    };

    const messages = normalizeMetaWebhook(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.platform).toBe("instagram");
    expect(messages[0]?.externalUserId).toBe("ig_user_99");
    expect(messages[0]?.text).toBe("Tem AirPods?");
  });

  it("normaliza Facebook Messenger (object page)", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "266953349832334",
          messaging: [
            {
              sender: { id: "psid_123" },
              postback: { title: "Falar com vendedor", payload: "HANDOFF", mid: "mid.fb.1" },
              timestamp: 1710000000000
            }
          ]
        }
      ]
    };

    const messages = normalizeMetaWebhook(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.platform).toBe("facebook");
    expect(messages[0]?.messageType).toBe("postback");
    expect(messages[0]?.text).toBe("Falar com vendedor");
  });

  it("ignora ecos (is_echo) do Messenger/Instagram", () => {
    const payload = {
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "page" },
              message: { mid: "mid.echo", text: "eco", is_echo: true }
            }
          ]
        }
      ]
    };
    expect(normalizeMetaWebhook(payload)).toHaveLength(0);
  });
});
