import { describe, expect, it } from "vitest";
import { parseInboundEvents, parseWhatsAppDeliveryStatuses } from "./inbound-events.parser";

describe("parseInboundEvents", () => {
  it("extrai mensagens de WhatsApp", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "123456" },
                contacts: [{ wa_id: "5585999999999", profile: { name: "Cliente Teste" } }],
                messages: [{ from: "5585999999999", id: "wamid.1", text: { body: "Qual o preço?" } }]
              }
            }
          ]
        }
      ]
    };

    const events = parseInboundEvents("whatsapp", payload);
    expect(events).toHaveLength(1);
    expect(events[0]?.senderId).toBe("5585999999999");
    expect(events[0]?.senderName).toBe("Cliente Teste");
  });

  it("extrai mensagens de Instagram", () => {
    const payload = {
      entry: [
        {
          id: "178414000000",
          messaging: [
            {
              sender: { id: "ig_user_1" },
              message: { mid: "mid.ig.1", text: "tem disponível?" }
            }
          ]
        }
      ]
    };

    const events = parseInboundEvents("instagram", payload);
    expect(events).toHaveLength(1);
    expect(events[0]?.senderId).toBe("ig_user_1");
    expect(events[0]?.conversationExternalId).toBe("178414000000");
  });

  it("extrai status de entrega do WhatsApp", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wamid.123",
                    status: "delivered",
                    recipient_id: "5585999999999"
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const statuses = parseWhatsAppDeliveryStatuses(payload);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.wamid).toBe("wamid.123");
    expect(statuses[0]?.status).toBe("delivered");
  });
});
