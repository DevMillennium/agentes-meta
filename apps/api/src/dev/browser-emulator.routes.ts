import type { Express } from "express";
import { env } from "../config/env";

const devConfigJson = JSON.stringify({
  adminEmail: env.ADMIN_EMAIL,
  adminPassword: env.ADMIN_PASSWORD,
  adminApiKey: env.ADMIN_API_KEY,
  metaAppSecret: env.META_APP_SECRET ?? "test-app-secret-local",
  metaAppId: env.META_APP_ID ?? "",
  metaOAuthLoginUrl: "/api/meta/oauth/login"
});

const EMULATOR_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phoenix API — emulador (dev)</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0 auto; max-width: 52rem; padding: 1.25rem; line-height: 1.45; }
    h1 { font-size: 1.25rem; }
    section { border: 1px solid #8884; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    label { display: block; margin: 0.35rem 0 0.15rem; font-weight: 600; }
    input, textarea, button { width: 100%; box-sizing: border-box; padding: 0.45rem; font: inherit; }
    textarea { min-height: 6rem; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    button { margin-top: 0.5rem; cursor: pointer; width: auto; }
    pre { background: #1112; padding: 0.75rem; overflow: auto; border-radius: 6px; white-space: pre-wrap; font-size: 0.8rem; }
    .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .muted { opacity: 0.75; font-size: 0.9rem; }
    .ok { color: #0a0; font-weight: 700; }
    .err { color: #c00; font-weight: 700; }
    a { color: inherit; }
  </style>
</head>
<body>
  <h1>Emulador Phoenix API</h1>
  <p id="status" class="muted">Iniciando…</p>

  <section>
    <h2>Health</h2>
    <div class="row">
      <button type="button" id="btn-health">GET /health</button>
    </div>
    <pre id="out-health">{}</pre>
  </section>

  <section>
    <h2>Auth (credenciais do .env local)</h2>
    <label for="email">E-mail</label>
    <input id="email" type="email" />
    <label for="password">Senha</label>
    <input id="password" type="password" />
    <label for="apikey">x-api-key</label>
    <input id="apikey" type="text" />
    <div class="row">
      <button type="button" id="btn-login">Login JWT</button>
      <button type="button" id="btn-clear">Limpar token</button>
    </div>
    <pre id="out-auth">{}</pre>
  </section>

  <section>
    <h2>API protegida</h2>
    <div class="row">
      <button type="button" id="btn-approvals">GET /api/approvals</button>
      <button type="button" id="btn-products">GET /api/products</button>
      <button type="button" id="btn-orchestrate">POST /api/agents/orchestrate</button>
    </div>
    <pre id="out-api">{}</pre>
  </section>

  <section>
    <h2>Meta (Marketing API + OAuth)</h2>
    <p class="muted">App: Phoenix Marketing Automat · Conecte o token Meta antes de testar campanhas/insights.</p>
    <div class="row">
      <a id="link-meta-oauth" href="/api/meta/oauth/login" target="_blank" rel="noopener"><button type="button">Conectar Meta (OAuth)</button></a>
      <button type="button" id="btn-meta-status">GET /api/meta/status</button>
      <button type="button" id="btn-meta-me">GET /api/meta/me</button>
      <button type="button" id="btn-meta-accounts">GET /api/meta/adaccounts</button>
      <button type="button" id="btn-meta-insights">POST /api/meta/insights</button>
    </div>
    <label for="meta-object-id">objectId (campaign ou act_XXX)</label>
    <input id="meta-object-id" type="text" placeholder="act_... ou ID da campanha" />
    <pre id="out-meta">{}</pre>
  </section>

  <section>
    <h2>Webhooks (com assinatura HMAC no navegador)</h2>
    <p class="muted">Simula mensagens WhatsApp / Instagram e status de entrega. Grava lead, conversa e resposta automática no Postgres.</p>
    <div class="row">
      <button type="button" id="btn-wa-inbound">WhatsApp: mensagem inbound</button>
      <button type="button" id="btn-wa-status">WhatsApp: status delivered</button>
      <button type="button" id="btn-ig-inbound">Instagram: mensagem inbound</button>
    </div>
    <pre id="out-webhook">{}</pre>
    <p class="muted">Challenge: <a href="/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_WEBHOOK_VERIFY_TOKEN)}&hub.challenge=ok" target="_blank">WhatsApp</a> · <a href="/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_WEBHOOK_VERIFY_TOKEN)}&hub.challenge=ok" target="_blank">Instagram</a></p>
  </section>

  <script>window.PHOENIX_DEV = ${devConfigJson};</script>
  <script src="/dev/emulator.js"></script>
</body>
</html>`;

const EMULATOR_JS = `
(function () {
  const cfg = window.PHOENIX_DEV || {};
  const $ = (id) => document.getElementById(id);
  const out = (id, data) => { $(id).textContent = JSON.stringify(data, null, 2); };
  const tokenKey = "phoenix_emulator_jwt";

  $("email").value = localStorage.getItem("phoenix_emulator_email") || cfg.adminEmail || "";
  $("password").value = cfg.adminPassword || "";
  $("apikey").value = localStorage.getItem("phoenix_emulator_apikey") || cfg.adminApiKey || "";

  function headersJson() {
    const headers = { "content-type": "application/json" };
    const token = localStorage.getItem(tokenKey);
    const apiKey = $("apikey").value.trim();
    if (token) headers["authorization"] = "Bearer " + token;
    if (apiKey) headers["x-api-key"] = apiKey;
    return headers;
  }

  async function hmacSha256Hex(secret, body) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function postWebhook(path, bodyObj) {
    const body = JSON.stringify(bodyObj);
    const secret = cfg.metaAppSecret || "";
    if (!secret) throw new Error("META_APP_SECRET não configurado no .env");
    const hex = await hmacSha256Hex(secret, body);
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=" + hex
      },
      body
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  $("btn-health").addEventListener("click", async () => {
    const res = await fetch("/health");
    out("out-health", { status: res.status, body: await res.json().catch(() => null) });
  });

  $("btn-login").addEventListener("click", async () => {
    const email = $("email").value.trim();
    const password = $("password").value;
    localStorage.setItem("phoenix_emulator_email", email);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json().catch(() => null);
    if (body && body.accessToken) localStorage.setItem(tokenKey, body.accessToken);
    out("out-auth", { status: res.status, body });
  });

  $("btn-clear").addEventListener("click", () => {
    localStorage.removeItem(tokenKey);
    out("out-auth", { cleared: true });
  });

  $("apikey").addEventListener("change", () => {
    localStorage.setItem("phoenix_emulator_apikey", $("apikey").value.trim());
  });

  async function getJson(path, targetId) {
    const res = await fetch(path, { headers: headersJson() });
    const body = await res.json().catch(() => null);
    out(targetId, { status: res.status, body });
  }

  $("btn-approvals").addEventListener("click", () => getJson("/api/approvals", "out-api"));

  $("btn-products").addEventListener("click", () => getJson("/api/products", "out-api"));

  $("btn-meta-status").addEventListener("click", () => getJson("/api/meta/status", "out-meta"));

  $("btn-meta-me").addEventListener("click", () => getJson("/api/meta/me", "out-meta"));

  $("btn-meta-accounts").addEventListener("click", () => getJson("/api/meta/adaccounts", "out-meta"));

  $("btn-meta-insights").addEventListener("click", async () => {
    const objectId = $("meta-object-id").value.trim();
    const res = await fetch("/api/meta/insights", {
      method: "POST",
      headers: headersJson(),
      body: JSON.stringify({ objectId: objectId || undefined, datePreset: "last_7d" })
    });
    const body = await res.json().catch(() => null);
    out("out-meta", { status: res.status, body });
  });

  $("btn-orchestrate").addEventListener("click", async () => {
    const res = await fetch("/api/agents/orchestrate", {
      method: "POST",
      headers: headersJson(),
      body: JSON.stringify({
        objective: "Vender produto prioritário",
        maxDailyBudget: 50,
        productId: "demo-product",
        campaignType: "messages",
        userId: "browser-emulator"
      })
    });
    const body = await res.json().catch(() => null);
    out("out-api", { status: res.status, body });
  });

  const waInbound = {
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: "123456" },
          contacts: [{ wa_id: "5585994482323", profile: { name: "Cliente Phoenix" } }],
          messages: [{ from: "5585994482323", id: "wamid.browser.1", text: { body: "Qual o preço do AirPods?" } }]
        }
      }]
    }]
  };

  const waStatus = {
    entry: [{
      changes: [{
        value: {
          statuses: [{ id: "wamid.browser.1", status: "delivered", recipient_id: "5585994482323" }]
        }
      }]
    }]
  };

  const igInbound = {
    entry: [{
      id: "178414000000",
      messaging: [{
        sender: { id: "ig_user_phoenix" },
        message: { mid: "mid.browser.1", text: "tem disponível?" }
      }]
    }]
  };

  $("btn-wa-inbound").addEventListener("click", async () => {
    try {
      out("out-webhook", await postWebhook("/webhooks/whatsapp", waInbound));
    } catch (e) {
      out("out-webhook", { error: String(e) });
    }
  });

  $("btn-wa-status").addEventListener("click", async () => {
    try {
      out("out-webhook", await postWebhook("/webhooks/whatsapp", waStatus));
    } catch (e) {
      out("out-webhook", { error: String(e) });
    }
  });

  $("btn-ig-inbound").addEventListener("click", async () => {
    try {
      out("out-webhook", await postWebhook("/webhooks/instagram", igInbound));
    } catch (e) {
      out("out-webhook", { error: String(e) });
    }
  });

  (async function boot() {
    const statusEl = $("status");
    try {
      const res = await fetch("/health");
      const body = await res.json().catch(() => null);
      if (res.ok) {
        statusEl.textContent = "API online em " + location.origin;
        statusEl.className = "ok";
        out("out-health", { status: res.status, body });
      } else {
        statusEl.textContent = "API respondeu com erro " + res.status;
        statusEl.className = "err";
      }
    } catch {
      statusEl.textContent = "API offline — rode: npm run emulate";
      statusEl.className = "err";
    }
  })();
})();
`;

export function registerBrowserEmulatorRoutes(app: Express): void {
  if (env.NODE_ENV === "production") {
    return;
  }

  app.get(["/dev/emulator", "/dev/emulator/"], (_req, res) => {
    res.type("html").send(EMULATOR_HTML);
  });

  app.get("/dev/emulator.js", (_req, res) => {
    res.type("application/javascript; charset=utf-8").send(EMULATOR_JS);
  });
}
