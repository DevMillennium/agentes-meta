/**
 * Simula webhooks Meta legados (mesmas URLs do app Meta) com assinatura HMAC.
 * Uso: npx tsx scripts/simulate-meta-webhook.ts [instagram|facebook|whatsapp|all]
 */
import crypto from "node:crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";

const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env") });

type Channel = "instagram" | "facebook" | "whatsapp";

const arg = (process.argv[2] ?? "instagram") as Channel | "all";
const apiBase = process.env.API_PUBLIC_URL ?? "http://localhost:4000";
const secret =
  process.env.META_APP_SECRET?.trim() ||
  (process.env.NODE_ENV !== "production" ? "test-app-secret-local" : "");

if (!secret) {
  console.error("META_APP_SECRET ausente.");
  process.exit(1);
}

function instagramPayload() {
  return {
    object: "instagram",
    entry: [
      {
        id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "17841405786843323",
        messaging: [
          {
            sender: { id: "sim_ig_001" },
            recipient: { id: "17841405786843323" },
            timestamp: Date.now(),
            message: {
              mid: `mid.ig.${Date.now()}`,
              text: "Simulação Instagram — Phoenix + Chatwoot"
            }
          }
        ]
      }
    ]
  };
}

function facebookPayload() {
  return {
    object: "page",
    entry: [
      {
        id: process.env.META_PAGE_ID || "266953349832334",
        messaging: [
          {
            sender: { id: "sim_fb_001" },
            recipient: { id: process.env.META_PAGE_ID || "266953349832334" },
            timestamp: Date.now(),
            message: {
              mid: `mid.fb.${Date.now()}`,
              text: "Simulação Facebook Messenger — Phoenix + Chatwoot"
            }
          }
        ]
      }
    ]
  };
}

function whatsappPayload() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || "123456789" },
              contacts: [{ wa_id: "5585999887766", profile: { name: "Simulado WA" } }],
              messages: [
                {
                  from: "5585999887766",
                  id: `wamid.sim.${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "Simulação WhatsApp — Phoenix + Chatwoot" }
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };
}

async function sendChannel(channel: Channel): Promise<{ channel: Channel; status: number; body: string }> {
  const payload =
    channel === "whatsapp" ? whatsappPayload() : channel === "facebook" ? facebookPayload() : instagramPayload();

  // Facebook Messenger usa o mesmo callback da Page — simulamos via /webhooks/instagram (URL legada do app).
  const webhookPath = channel === "whatsapp" ? "whatsapp" : "instagram";
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const url = `${apiBase.replace(/\/$/, "")}/webhooks/${webhookPath}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": `sha256=${sig}`
    },
    body
  });

  const text = await res.text();
  console.log(`POST ${url} [${channel}] → ${res.status}`);
  console.log(text);
  console.log("");
  return { channel, status: res.status, body: text };
}

async function main(): Promise<void> {
  const channels: Channel[] = arg === "all" ? ["instagram", "facebook", "whatsapp"] : [arg];
  const results = [];
  for (const ch of channels) {
    results.push(await sendChannel(ch));
    await new Promise((r) => setTimeout(r, 1500));
  }
  const failed = results.filter((r) => r.status !== 200);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
