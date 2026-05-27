import type { Express } from "express";
import { env } from "../config/env";

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
    section { border: 1px solid #ccc; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    label { display: block; margin: 0.35rem 0 0.15rem; font-weight: 600; }
    input, textarea, button { width: 100%; box-sizing: border-box; padding: 0.45rem; font: inherit; }
    textarea { min-height: 7rem; font-family: ui-monospace, monospace; }
    button { margin-top: 0.5rem; cursor: pointer; width: auto; }
    pre { background: #1112; padding: 0.75rem; overflow: auto; border-radius: 6px; white-space: pre-wrap; }
    .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .muted { opacity: 0.75; font-size: 0.9rem; }
    a { color: inherit; }
  </style>
</head>
<body>
  <h1>Emulador do backend (somente desenvolvimento)</h1>
  <p class="muted">Mesma origem da API — sem CORS. Não habilitado em <code>NODE_ENV=production</code>.</p>

  <section>
    <h2>Health</h2>
    <p><a href="/health" target="_blank" rel="noopener">Abrir <code>/health</code> em nova aba</a></p>
    <div class="row">
      <button type="button" id="btn-health">GET /health (fetch)</button>
    </div>
    <pre id="out-health">{}</pre>
  </section>

  <section>
    <h2>Auth</h2>
    <label for="email">E-mail admin</label>
    <input id="email" type="email" autocomplete="username" />
    <label for="password">Senha</label>
    <input id="password" type="password" autocomplete="current-password" />
    <div class="row">
      <button type="button" id="btn-login">POST /api/auth/login</button>
      <button type="button" id="btn-clear">Limpar token</button>
    </div>
    <pre id="out-auth">{}</pre>
  </section>

  <section>
    <h2>API protegida</h2>
    <p class="muted">Usa <code>Authorization: Bearer</code> do login ou cole <code>x-api-key</code>.</p>
    <label for="apikey">x-api-key (opcional)</label>
    <input id="apikey" type="password" autocomplete="off" placeholder="ADMIN_API_KEY" />
    <div class="row" style="margin-top:0.5rem">
      <button type="button" id="btn-approvals">GET /api/approvals</button>
      <button type="button" id="btn-products">GET /api/products</button>
    </div>
    <pre id="out-api">{}</pre>
  </section>

  <section>
    <h2>Orquestrador</h2>
    <label for="orch-body">JSON (POST /api/agents/orchestrate)</label>
    <textarea id="orch-body">{
  "objective": "Vender produto prioritário",
  "maxDailyBudget": 50,
  "productId": "demo-product",
  "campaignType": "messages",
  "userId": "browser-emulator"
}</textarea>
    <button type="button" id="btn-orchestrate">POST /api/agents/orchestrate</button>
    <pre id="out-orch">{}</pre>
  </section>

  <section>
    <h2>Webhooks Meta</h2>
    <p class="muted">A Meta exige <code>x-hub-signature-256</code> (HMAC-SHA256 do corpo com <code>META_APP_SECRET</code>). Use curl/Postman ou implemente assinatura no cliente só para testes locais.</p>
    <p>Verify token configurado: <code>${escapeHtml(env.META_WEBHOOK_VERIFY_TOKEN)}</code></p>
    <p><a href="/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_WEBHOOK_VERIFY_TOKEN)}&hub.challenge=demo123" target="_blank" rel="noopener">Testar challenge WhatsApp</a></p>
    <p><a href="/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_WEBHOOK_VERIFY_TOKEN)}&hub.challenge=demo456" target="_blank" rel="noopener">Testar challenge Instagram</a></p>
  </section>

  <script src="/dev/emulator.js" defer></script>
</body>
</html>`;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const EMULATOR_JS = `
(function () {
  const $ = (id) => document.getElementById(id);
  const out = (id, data) => { $(id).textContent = JSON.stringify(data, null, 2); };

  const tokenKey = "phoenix_emulator_jwt";

  function headersJson() {
    const headers = { "content-type": "application/json" };
    const token = localStorage.getItem(tokenKey);
    const apiKey = $("apikey").value.trim();
    if (token) headers["authorization"] = "Bearer " + token;
    if (apiKey) headers["x-api-key"] = apiKey;
    return headers;
  }

  $("email").value = localStorage.getItem("phoenix_emulator_email") || "";
  $("apikey").value = localStorage.getItem("phoenix_emulator_apikey") || "";

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

  $("btn-orchestrate").addEventListener("click", async () => {
    let payload;
    try {
      payload = JSON.parse($("orch-body").value);
    } catch (e) {
      out("out-orch", { error: "JSON inválido", message: String(e) });
      return;
    }
    const res = await fetch("/api/agents/orchestrate", {
      method: "POST",
      headers: headersJson(),
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => null);
    out("out-orch", { status: res.status, body });
  });
})();
`;

export function registerBrowserEmulatorRoutes(app: Express): void {
  if (env.NODE_ENV === "production") {
    return;
  }

  app.get("/dev/emulator", (_req, res) => {
    res.type("html").send(EMULATOR_HTML);
  });

  app.get("/dev/emulator.js", (_req, res) => {
    res.type("application/javascript; charset=utf-8").send(EMULATOR_JS);
  });
}
