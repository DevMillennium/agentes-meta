import type { Express } from "express";
import { env } from "../config/env";

const CONSOLE_CONFIG = JSON.stringify({
  apiBase: "",
  metaAppId: env.META_APP_ID ?? "",
  metaApiVersion: env.META_API_VERSION,
  adminEmail: env.ADMIN_EMAIL
});

const CONSOLE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phoenix Console — Agentes & Meta</title>
  <style>
    :root { --bg:#0f172a; --card:#1e293b; --text:#e2e8f0; --muted:#94a3b8; --accent:#3b82f6; --ok:#22c55e; --err:#ef4444; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
    header { padding:1rem 1.5rem; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem; }
    header h1 { margin:0; font-size:1.1rem; }
    .wrap { display:grid; grid-template-columns:220px 1fr; min-height:calc(100vh - 60px); }
    nav { border-right:1px solid #334155; padding:1rem; }
    nav button { display:block; width:100%; text-align:left; margin-bottom:.35rem; padding:.55rem .75rem; background:transparent; border:none; color:var(--muted); border-radius:6px; cursor:pointer; font:inherit; }
    nav button.active, nav button:hover { background:var(--card); color:#fff; }
    main { padding:1.25rem; overflow:auto; }
    .card { background:var(--card); border-radius:10px; padding:1rem; margin-bottom:1rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:.75rem; }
    .stat strong { display:block; font-size:1.4rem; }
    .stat span { color:var(--muted); font-size:.85rem; }
    label { display:block; margin:.5rem 0 .2rem; font-size:.85rem; color:var(--muted); }
    input, select, textarea { width:100%; padding:.5rem; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font:inherit; }
    textarea { min-height:80px; font-family:ui-monospace,monospace; font-size:.8rem; }
    .row { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.5rem; }
    .btn { padding:.5rem 1rem; border-radius:6px; border:none; cursor:pointer; font:inherit; background:var(--accent); color:#fff; }
    .btn.secondary { background:#475569; }
    .btn.danger { background:#b91c1c; }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
    pre { background:#020617; padding:.75rem; border-radius:8px; overflow:auto; font-size:.75rem; max-height:320px; }
    .badge { display:inline-block; padding:2px 8px; border-radius:99px; font-size:.75rem; }
    .badge.ok { background:#14532d; color:#86efac; }
    .badge.err { background:#450a0a; color:#fca5a5; }
    .agent { border:1px solid #334155; border-radius:8px; padding:.75rem; margin-bottom:.5rem; }
    #login-panel { max-width:400px; margin:4rem auto; }
    .hidden { display:none !important; }
    a { color:#93c5fd; }
  </style>
</head>
<body>
  <header>
    <h1>Phoenix Global Market Automat</h1>
    <span id="user-label" class="muted">Não autenticado</span>
  </header>

  <div id="login-panel" class="card">
    <h2>Entrar na plataforma</h2>
    <label>E-mail</label>
    <input id="login-email" type="email" />
    <label>Senha</label>
    <input id="login-password" type="password" />
    <div class="row">
      <button class="btn" id="btn-login">Entrar</button>
    </div>
    <p class="muted" style="margin-top:1rem">Backend unificado: agentes, Meta, conversas e campanhas.</p>
  </div>

  <div id="app-shell" class="hidden">
    <div class="wrap">
      <nav>
        <button data-tab="overview" class="active">Visão geral</button>
        <button data-tab="meta">Meta / OAuth</button>
        <button data-tab="agents">Agentes</button>
        <button data-tab="actions">Auditoria</button>
        <button data-tab="products">Produtos</button>
        <button data-tab="conversations">Conversas</button>
        <button data-tab="raw">API Raw</button>
        <button class="secondary" id="btn-logout" style="margin-top:1rem">Sair</button>
      </nav>
      <main>
        <section id="tab-overview"></section>
        <section id="tab-meta" class="hidden"></section>
        <section id="tab-agents" class="hidden"></section>
        <section id="tab-actions" class="hidden"></section>
        <section id="tab-products" class="hidden"></section>
        <section id="tab-conversations" class="hidden"></section>
        <section id="tab-raw" class="hidden"></section>
      </main>
    </div>
  </div>

  <script>window.PHOENIX_CONSOLE=${CONSOLE_CONFIG};</script>
  <script src="/console/app.js"></script>
</body>
</html>`;

export function registerBrowserConsoleRoutes(app: Express): void {
  app.get(["/console", "/console/"], (_req, res) => {
    res.type("html").send(CONSOLE_HTML);
  });

  app.get("/console/app.js", (_req, res) => {
    res.type("application/javascript").send(CONSOLE_JS);
  });
}

const CONSOLE_JS = `
(function () {
  const cfg = window.PHOENIX_CONSOLE || {};
  const TOKEN_KEY = "phoenix_console_jwt";
  const $ = (id) => document.getElementById(id);

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function headers() {
    const h = { "content-type": "application/json" };
    if (token()) h.authorization = "Bearer " + token();
    return h;
  }
  async function api(path, opts) {
    const res = await fetch((cfg.apiBase || "") + path, { ...opts, headers: { ...headers(), ...(opts && opts.headers) } });
    const body = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, body };
  }

  function showApp(show) {
    $("login-panel").classList.toggle("hidden", show);
    $("app-shell").classList.toggle("hidden", !show);
  }

  async function loadSession() {
    const me = await api("/api/auth/me");
    if (!me.ok) { showApp(false); return null; }
    $("user-label").textContent = me.body.user?.email || "Autenticado";
    showApp(true);
    return me.body;
  }

  function tab(name) {
    document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    ["overview","meta","agents","actions","products","conversations","raw"].forEach((t) => {
      $("tab-" + t).classList.toggle("hidden", t !== name);
    });
  }

  function renderOverview(session) {
    const p = session.platform;
    const m = p.meta;
    $("tab-overview").innerHTML = \`
      <h2>Visão geral</h2>
      <div class="grid">
        <div class="stat card"><strong>\${p.stats.leads}</strong><span>Leads</span></div>
        <div class="stat card"><strong>\${p.stats.conversations}</strong><span>Conversas</span></div>
        <div class="stat card"><strong>\${p.stats.campaigns}</strong><span>Campanhas</span></div>
        <div class="stat card"><strong>\${p.stats.activeProducts}</strong><span>Produtos</span></div>
        <div class="stat card"><strong>\${p.stats.pendingApprovals}</strong><span>Aprovações</span></div>
        <div class="stat card"><strong>\${p.agents.total}</strong><span>Agentes</span></div>
      </div>
      <div class="card" style="margin-top:1rem">
        <h3>Meta</h3>
        <p>Token: <span class="badge \${m.hasAccessToken?"ok":"err"}">\${m.hasAccessToken?"Conectado":"Desconectado"}</span></p>
        <p class="muted">WhatsApp: \${m.whatsappReady?"Pronto":"—"} · Instagram: \${m.instagramReady?"Pronto":"—"} · Ads: \${m.marketingReady?"Pronto":"—"}</p>
      </div>\`;
  }

  function renderMeta() {
    $("tab-meta").innerHTML = \`
      <h2>Integração Meta</h2>
      <div class="card">
        <p>Conecte o app <strong>Phoenix Marketing Automat</strong> direto aos sistemas Meta.</p>
        <div class="row">
          <a class="btn" href="/api/meta/oauth/login" target="_blank">OAuth servidor (recomendado)</a>
          <button class="btn secondary" id="btn-sync-meta">Sincronizar ativos</button>
          <button class="btn secondary" id="btn-meta-status">Atualizar status</button>
        </div>
        <pre id="meta-out">{}</pre>
      </div>\`;
    $("btn-sync-meta").onclick = async () => {
      const r = await api("/api/meta/sync-assets", { method: "POST" });
      $("meta-out").textContent = JSON.stringify(r, null, 2);
      await loadSession().then((s) => s && renderOverview(s));
    };
    $("btn-meta-status").onclick = async () => {
      const r = await api("/api/meta/status");
      $("meta-out").textContent = JSON.stringify(r, null, 2);
    };
    api("/api/meta/status").then((r) => { $("meta-out").textContent = JSON.stringify(r, null, 2); });
  }

  async function renderAgents() {
    const list = await api("/api/agents");
    const products = await api("/api/products");
    const productOpts = (products.body?.items || []).map((p) => '<option value="'+p.id+'">'+p.name+'</option>').join("");
    let html = '<h2>Agentes</h2><div class="card"><label>Produto</label><select id="orch-product">'+productOpts+'</select>';
    html += '<label>Objetivo</label><input id="orch-objective" value="Vender produto prioritário" />';
    html += '<label>Orçamento diário</label><input id="orch-budget" type="number" value="50" />';
    html += '<div class="row"><button class="btn" id="btn-orchestrate">Executar ciclo completo</button></div><pre id="orch-out">{}</pre></div>';
    html += '<h3>Executar agente individual</h3>';
    (list.body?.items || []).forEach((a) => {
      html += '<div class="agent"><strong>'+a.name+'</strong><p class="muted">'+a.description+'</p>';
      html += '<button class="btn secondary btn-run-agent" data-key="'+a.key+'">Executar</button></div>';
    });
    html += '<pre id="agent-out">{}</pre>';
    $("tab-agents").innerHTML = html;
    $("btn-orchestrate").onclick = async () => {
      const r = await api("/api/agents/orchestrate", {
        method: "POST",
        body: JSON.stringify({
          productId: $("orch-product").value,
          objective: $("orch-objective").value,
          maxDailyBudget: Number($("orch-budget").value),
          campaignType: "messages"
        })
      });
      $("orch-out").textContent = JSON.stringify(r, null, 2);
    };
    document.querySelectorAll(".btn-run-agent").forEach((btn) => {
      btn.onclick = async () => {
        const key = btn.dataset.key;
        const r = await api("/api/agents/"+key+"/run", {
          method: "POST",
          body: JSON.stringify({ objective: "teste", productId: $("orch-product").value })
        });
        $("agent-out").textContent = JSON.stringify(r, null, 2);
      };
    });
  }

  async function renderActions() {
    const r = await api("/api/agents/actions?limit=30");
    $("tab-actions").innerHTML = '<h2>Auditoria de agentes</h2><pre>'+JSON.stringify(r.body, null, 2)+'</pre>';
  }

  async function renderProducts() {
    const r = await api("/api/products");
    $("tab-products").innerHTML = '<h2>Produtos</h2><div class="row"><button class="btn secondary" id="btn-seed">Seed padrão</button></div><pre>'+JSON.stringify(r.body, null, 2)+'</pre>';
    $("btn-seed").onclick = async () => {
      await api("/api/products/seed/default", { method: "POST" });
      renderProducts();
    };
  }

  async function renderConversations() {
    const r = await api("/api/conversations");
    $("tab-conversations").innerHTML = '<h2>Conversas</h2><pre>'+JSON.stringify(r.body, null, 2)+'</pre>';
  }

  function renderRaw() {
    $("tab-raw").innerHTML = \`
      <h2>API Raw</h2>
      <label>Path (ex: /api/platform/overview)</label>
      <input id="raw-path" value="/api/platform/overview" />
      <label>Body JSON</label>
      <textarea id="raw-body">{}</textarea>
      <div class="row">
        <button class="btn" data-method="GET">GET</button>
        <button class="btn secondary" data-method="POST">POST</button>
      </div>
      <pre id="raw-out">{}</pre>\`;
    $("tab-raw").querySelectorAll("button[data-method]").forEach((b) => {
      b.onclick = async () => {
        const method = b.dataset.method;
        const opts = { method };
        if (method === "POST") opts.body = $("raw-body").value;
        const r = await api($("raw-path").value, opts);
        $("raw-out").textContent = JSON.stringify(r, null, 2);
      };
    });
  }

  document.querySelectorAll("nav button[data-tab]").forEach((btn) => {
    btn.onclick = async () => {
      tab(btn.dataset.tab);
      if (btn.dataset.tab === "agents") await renderAgents();
      if (btn.dataset.tab === "actions") await renderActions();
      if (btn.dataset.tab === "products") await renderProducts();
      if (btn.dataset.tab === "conversations") await renderConversations();
      if (btn.dataset.tab === "meta") renderMeta();
      if (btn.dataset.tab === "raw") renderRaw();
    };
  });

  $("btn-login").onclick = async () => {
    const r = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: $("login-email").value, password: $("login-password").value })
    });
    if (r.ok && r.body.accessToken) {
      localStorage.setItem(TOKEN_KEY, r.body.accessToken);
      const s = await loadSession();
      if (s) { renderOverview(s); renderMeta(); tab("overview"); }
    } else alert("Login falhou");
  };

  $("btn-logout").onclick = () => {
    localStorage.removeItem(TOKEN_KEY);
    showApp(false);
  };

  $("login-email").value = cfg.adminEmail || "";
  if (token()) {
    loadSession().then((s) => {
      if (s) { renderOverview(s); renderMeta(); tab("overview"); }
    });
  }
})();
`;
