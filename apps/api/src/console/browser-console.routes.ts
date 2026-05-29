import type { Express } from "express";
import { env, getApiPublicUrl } from "../config/env";

/**
 * Só expõe credenciais de conveniência quando a API está rodando localmente.
 * Em produção (Vercel) NUNCA inclui senha/API key no HTML público — mesmo que
 * NODE_ENV não venha como "production" no runtime serverless.
 */
function isLocalEnvironment(): boolean {
  const url = getApiPublicUrl();
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function buildConsoleConfig(): string {
  const local = isLocalEnvironment();
  return JSON.stringify({
    apiBase: "",
    metaAppId: env.META_APP_ID ?? "",
    metaApiVersion: env.META_API_VERSION,
    adminEmail: env.ADMIN_EMAIL,
    adminPassword: local ? env.ADMIN_PASSWORD : "",
    adminApiKey: local ? env.ADMIN_API_KEY : "",
    isDev: local
  });
}

function buildConsoleHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phoenix Console — Agentes & Meta</title>
  <style>
    :root { --bg:#0b1220; --card:#161f30; --card2:#1e293b; --text:#e8eef7; --muted:#94a3b8; --accent:#3b82f6; --accent2:#0ea5e9; --ok:#22c55e; --err:#ef4444; --border:#28344a; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
    header { padding:1rem 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem; background:#0d1626; }
    header h1 { margin:0; font-size:1.1rem; }
    .wrap { display:grid; grid-template-columns:230px 1fr; min-height:calc(100vh - 60px); }
    nav { border-right:1px solid var(--border); padding:1rem; background:#0d1626; }
    nav button { display:flex; align-items:center; gap:.55rem; width:100%; text-align:left; margin-bottom:.25rem; padding:.6rem .8rem; background:transparent; border:none; color:var(--muted); border-radius:8px; cursor:pointer; font:inherit; transition:background .12s,color .12s; }
    nav button .ico { width:18px; text-align:center; opacity:.9; }
    nav button.active, nav button:hover { background:var(--card2); color:#fff; }
    nav button.active { box-shadow:inset 3px 0 0 var(--accent2); }
    main { padding:1.5rem; overflow:auto; }
    h2 { margin:0 0 1rem; font-size:1.3rem; }
    h3 { margin:0 0 .6rem; font-size:1rem; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.1rem; margin-bottom:1rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:.85rem; }
    .stat { background:linear-gradient(160deg,#1a2742,#141d30); border:1px solid var(--border); border-radius:12px; padding:1rem; }
    .stat strong { display:block; font-size:1.8rem; line-height:1.1; }
    .stat span { color:var(--muted); font-size:.8rem; }
    label { display:block; margin:.6rem 0 .25rem; font-size:.82rem; color:var(--muted); }
    input, select, textarea { width:100%; padding:.55rem .65rem; border-radius:8px; border:1px solid #394861; background:#0b1426; color:#fff; font:inherit; }
    textarea { min-height:80px; font-family:ui-monospace,monospace; font-size:.8rem; }
    .row { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.6rem; }
    .btn { padding:.55rem 1.05rem; border-radius:8px; border:none; cursor:pointer; font:inherit; background:linear-gradient(135deg,#3b82f6,#0e63d8); color:#fff; font-weight:500; }
    .btn:hover { filter:brightness(1.07); }
    .btn.secondary { background:#33415a; }
    .btn.danger { background:#b91c1c; }
    .btn.sm { padding:.4rem .7rem; font-size:.82rem; }
    .btn:disabled { opacity:.5; cursor:not-allowed; }
    pre { background:#05080f; padding:.75rem; border-radius:8px; overflow:auto; font-size:.75rem; max-height:320px; border:1px solid var(--border); }
    table { width:100%; border-collapse:collapse; font-size:.86rem; }
    th, td { text-align:left; padding:.55rem .6rem; border-bottom:1px solid var(--border); }
    th { color:var(--muted); font-weight:600; font-size:.78rem; text-transform:uppercase; letter-spacing:.03em; }
    tr:hover td { background:#121b2d; }
    .badge { display:inline-block; padding:2px 9px; border-radius:99px; font-size:.74rem; font-weight:500; }
    .badge.ok { background:#0f3d24; color:#6ee7a8; }
    .badge.err { background:#3d1212; color:#fca5a5; }
    .badge.warn { background:#3d3312; color:#fde68a; }
    .badge.info { background:#102a45; color:#7dd3fc; }
    .agent { border:1px solid var(--border); border-radius:10px; padding:.85rem; margin-bottom:.6rem; background:var(--card2); }
    .agent-head { display:flex; justify-content:space-between; align-items:center; gap:.5rem; }
    .muted { color:var(--muted); }
    .empty { color:var(--muted); padding:1rem; text-align:center; border:1px dashed var(--border); border-radius:10px; }
    .ig-row { display:flex; align-items:center; gap:.6rem; }
    .ig-avatar { width:34px; height:34px; border-radius:50%; object-fit:cover; }
    .spinner { color:var(--muted); }
    #login-panel { max-width:420px; margin:4rem auto; }
    .hidden { display:none !important; }
    a { color:#7dd3fc; }
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
    <label>x-api-key (alternativa)</label>
    <input id="login-apikey" type="text" placeholder="ADMIN_API_KEY do .env" />
    <div class="row">
      <button class="btn" id="btn-login">Entrar com e-mail</button>
      <button class="btn secondary" id="btn-login-key">Entrar com API Key</button>
      <button class="btn secondary hidden" id="btn-fill-local">Preencher credenciais locais</button>
    </div>
    <p class="muted" style="margin-top:1rem">Sessão compartilhada com CRM e emulador no mesmo domínio.</p>
  </div>

  <div id="app-shell" class="hidden">
    <div class="wrap">
      <nav>
        <button data-tab="overview" class="active"><span class="ico">📊</span> Visão geral</button>
        <button data-tab="platform"><span class="ico">🧩</span> Plataforma</button>
        <button data-tab="users"><span class="ico">👤</span> Usuários</button>
        <button data-tab="meta"><span class="ico">🔗</span> Meta / OAuth</button>
        <button data-tab="agents"><span class="ico">🤖</span> Agentes</button>
        <button data-tab="actions"><span class="ico">📝</span> Auditoria</button>
        <button data-tab="products"><span class="ico">📦</span> Produtos</button>
        <button data-tab="conversations"><span class="ico">💬</span> Conversas</button>
        <button data-tab="leads"><span class="ico">🎯</span> Leads CRM</button>
        <button data-tab="raw"><span class="ico">⚙️</span> API Raw</button>
        <a href="/" style="display:block;margin-top:1rem;color:#7dd3fc;font-size:.85rem;text-decoration:none">← Centro de ferramentas</a>
        <a href="/tools/emulator" style="display:block;margin-top:.35rem;color:#7dd3fc;font-size:.85rem;text-decoration:none">Emulador webhooks</a>
        <button class="secondary" id="btn-logout" style="margin-top:1rem">Sair</button>
      </nav>
      <main>
        <section id="tab-overview"></section>
        <section id="tab-platform" class="hidden"></section>
        <section id="tab-users" class="hidden"></section>
        <section id="tab-meta" class="hidden"></section>
        <section id="tab-agents" class="hidden"></section>
        <section id="tab-actions" class="hidden"></section>
        <section id="tab-products" class="hidden"></section>
        <section id="tab-conversations" class="hidden"></section>
        <section id="tab-leads" class="hidden"></section>
        <section id="tab-raw" class="hidden"></section>
      </main>
    </div>
  </div>

  <script>window.PHOENIX_CONSOLE=${buildConsoleConfig()};</script>
  <script src="/shared/auth.js"></script>
  <script src="/console/app.js"></script>
</body>
</html>`;
}

export function registerBrowserConsoleRoutes(app: Express): void {
  app.get(["/console", "/console/"], (_req, res) => {
    res.type("html").send(buildConsoleHtml());
  });

  app.get("/console/app.js", (_req, res) => {
    res.type("application/javascript").send(CONSOLE_JS);
  });
}

const CONSOLE_JS = `
(function () {
  const cfg = window.PHOENIX_CONSOLE || {};
  const auth = window.PhoenixAuth;
  const $ = (id) => document.getElementById(id);
  const api = (path, opts) => auth.api((cfg.apiBase || "") + path, opts);
  const TABS = ["overview","platform","users","meta","agents","actions","products","conversations","leads","raw"];

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function badge(ok, textOk, textErr, warn) {
    const cls = ok ? "ok" : (warn ? "warn" : "err");
    return '<span class="badge ' + cls + '">' + esc(ok ? textOk : textErr) + '</span>';
  }
  function fmtDate(v) { if (!v) return "—"; try { return new Date(v).toLocaleString("pt-BR"); } catch (e) { return String(v); } }
  function setHTML(id, html) { const el = $(id); if (el) el.innerHTML = html; }
  function loading(id, label) { setHTML(id, '<h2>' + esc(label) + '</h2><p class="spinner">Carregando…</p>'); }
  function tableHTML(headers, rows) {
    if (!rows.length) return '<div class="empty">Nenhum registro.</div>';
    let h = '<div class="card" style="padding:0;overflow:auto"><table><thead><tr>';
    headers.forEach((x) => { h += '<th>' + esc(x) + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach((cells) => {
      h += '<tr>';
      cells.forEach((c) => { h += '<td>' + c + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function showApp(show) {
    $("login-panel").classList.toggle("hidden", show);
    $("app-shell").classList.toggle("hidden", !show);
  }

  async function loadSession() {
    const me = await api("/api/auth/me");
    if (!me.ok) { showApp(false); return null; }
    const u = me.body.user;
    $("user-label").textContent = (u && u.email ? u.email : "Autenticado") + " (" + (u && u.role ? u.role : "?") + ")";
    showApp(true);
    return me.body;
  }

  function selectTab(name) {
    if (TABS.indexOf(name) === -1) return;
    document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    TABS.forEach((t) => { const el = $("tab-" + t); if (el) el.classList.toggle("hidden", t !== name); });
    void renderTab(name);
  }

  async function renderTab(name) {
    try {
      if (name === "overview") return renderOverview(window.__phoenixSession);
      if (name === "platform") return renderPlatform(window.__phoenixSession);
      if (name === "users") return renderUsers();
      if (name === "meta") return renderMeta();
      if (name === "agents") return renderAgents();
      if (name === "actions") return renderActions();
      if (name === "products") return renderProducts();
      if (name === "conversations") return renderConversations();
      if (name === "leads") return renderLeads();
      if (name === "raw") return renderRaw();
    } catch (e) {
      setHTML("tab-" + name, '<h2>Erro</h2><div class="card">' + esc(e && e.message ? e.message : e) + '</div>');
    }
  }

  async function openMetaOAuthServer() {
    const r = await api("/api/meta/oauth/login-url");
    if (!r.ok || !r.body || !r.body.url) {
      alert("Falha ao iniciar OAuth Meta: " + ((r.body && r.body.error) || r.status));
      return;
    }
    window.open(r.body.url, "_blank", "noopener,noreferrer");
  }

  function renderOverview(session) {
    if (!session) { loading("tab-overview", "Visão geral"); return; }
    const p = session.platform; const m = p.meta;
    setHTML("tab-overview", \`
      <h2>Visão geral</h2>
      <div class="grid">
        <div class="stat"><strong>\${p.stats.leads}</strong><span>Leads</span></div>
        <div class="stat"><strong>\${p.stats.conversations}</strong><span>Conversas</span></div>
        <div class="stat"><strong>\${p.stats.campaigns}</strong><span>Campanhas</span></div>
        <div class="stat"><strong>\${p.stats.activeProducts}</strong><span>Produtos ativos</span></div>
        <div class="stat"><strong>\${p.stats.pendingApprovals}</strong><span>Aprovações</span></div>
        <div class="stat"><strong>\${p.agents.total}</strong><span>Agentes</span></div>
      </div>
      <div class="card" style="margin-top:1rem">
        <h3>Integração Meta</h3>
        <p>Token: \${badge(m.hasAccessToken, "Conectado", "Desconectado")}</p>
        <p class="muted">WhatsApp: \${m.whatsappReady?"Pronto":"—"} · Instagram: \${m.instagramReady?"Pronto":"—"} · Ads: \${m.marketingReady?"Pronto":"—"}</p>
      </div>\`);
  }

  function renderPlatform(session) {
    if (!session) { loading("tab-platform", "Plataforma"); return; }
    const m = session.platform.meta;
    setHTML("tab-platform", \`
      <h2>Plataforma</h2>
      <div class="card">
        <h3>Sessão atual</h3>
        <p><strong>\${esc(session.user && session.user.email)}</strong> · perfil <code>\${esc(session.user && session.user.role)}</code></p>
        <p class="muted">userId: \${esc(session.user && session.user.userId)}</p>
      </div>
      <div class="card">
        <h3>Integração Meta</h3>
        <p>OAuth: \${badge(m.oauthConfigured, "Configurado", "Não configurado")}
           Token: \${badge(m.hasAccessToken, "Ativo", "Ausente")}</p>
        <p class="muted">WhatsApp \${m.whatsappReady?"✓":"—"} · Instagram \${m.instagramReady?"✓":"—"} · Ads \${m.marketingReady?"✓":"—"}</p>
        <p class="muted">Expira: \${fmtDate(m.tokenExpiresAt)} · Ativos sync: \${fmtDate(m.assetsSyncedAt)}</p>
        <div class="row"><button class="btn" data-act="meta-oauth">Conectar Meta OAuth</button></div>
      </div>
      <div class="card">
        <h3>Operação</h3>
        <p>\${session.platform.agents.total} agentes · \${session.platform.stats.leads} leads · \${session.platform.stats.conversations} conversas</p>
      </div>\`);
  }

  async function renderUsers() {
    loading("tab-users", "Usuários");
    const r = await api("/api/auth/users");
    if (!r.ok) { setHTML("tab-users", '<h2>Usuários</h2><div class="card">Requer perfil admin. Erro ' + r.status + '</div>'); return; }
    const rows = (r.body.items || []).map((u) => {
      const meta = u.metaConnection;
      const metaCell = meta ? badge(true, meta.assetsSyncedAt ? "Conectado (ativos OK)" : "Conectado (sync pendente)", "") : badge(false, "", "Não conectado");
      return [esc(u.name), esc(u.email), '<span class="badge info">' + esc(u.role) + '</span>', metaCell];
    });
    setHTML("tab-users", '<h2>Usuários da plataforma</h2>' + tableHTML(["Nome","E-mail","Perfil","Meta"], rows));
  }

  function renderAssetsBlock(a) {
    if (!a || !a.ok) {
      return '<div class="card"><h3>Ativos conectados</h3><p class="muted">' + esc((a && a.error) || "Conecte sua conta Meta para listar ativos.") + '</p></div>';
    }
    const igRows = (a.instagramAccounts || []).map((ig) => {
      const av = ig.profilePictureUrl ? '<img class="ig-avatar" src="' + esc(ig.profilePictureUrl) + '" alt="" />' : '';
      return [
        '<div class="ig-row">' + av + '<span><strong>@' + esc(ig.username || ig.id) + '</strong></span></div>',
        (ig.followersCount != null ? ig.followersCount : "—"),
        esc(ig.linkedPageName || "—")
      ];
    });
    const bizRows = (a.businesses || []).map((b) => [esc(b.name || b.id), esc(b.id), '<span class="badge ' + (b.verificationStatus === "verified" ? "ok" : "warn") + '">' + esc(b.verificationStatus || "—") + '</span>']);
    const adRows = (a.adAccounts || []).map((x) => [esc(x.name || x.id), esc(x.id), esc(x.currency || "—")]);
    const pageRows = (a.pages || []).map((p) => [esc(p.name || p.id), esc(p.id), p.instagramBusinessAccountId ? badge(true, "IG vinculado", "") : "—"]);
    const waRows = (a.whatsappAccounts || []).map((w) => [esc(w.name || w.wabaId), (w.phoneNumbers || []).map((p) => esc(p.displayPhoneNumber || p.id)).join(", ") || "—"]);
    return \`
      <div class="card">
        <h3>Conta: \${esc(a.me && a.me.name)} <span class="muted">(\${esc(a.me && a.me.id)})</span></h3>
        <h3 style="margin-top:1rem">Instagram conectados (\${(a.instagramAccounts||[]).length})</h3>
        \${tableHTML(["Conta","Seguidores","Página"], igRows)}
        <h3 style="margin-top:1rem">Contas Business (\${(a.businesses||[]).length})</h3>
        \${tableHTML(["Nome","ID","Verificação"], bizRows)}
        <h3 style="margin-top:1rem">Contas de anúncio (\${(a.adAccounts||[]).length})</h3>
        \${tableHTML(["Nome","ID","Moeda"], adRows)}
        <h3 style="margin-top:1rem">Páginas (\${(a.pages||[]).length})</h3>
        \${tableHTML(["Nome","ID","Instagram"], pageRows)}
        <h3 style="margin-top:1rem">WhatsApp Business (\${(a.whatsappAccounts||[]).length})</h3>
        \${tableHTML(["Conta","Números"], waRows)}
      </div>\`;
  }

  async function renderMeta() {
    loading("tab-meta", "Integração Meta");
    const status = await api("/api/meta/status");
    const m = status.body || {};
    let assetsHtml = '<div class="card"><p class="spinner">Carregando ativos…</p></div>';
    setHTML("tab-meta", \`
      <h2>Integração Meta</h2>
      <div class="card">
        <p>Token no servidor: \${badge(m.hasAccessToken, "Conectado", "Ausente")}
           · OAuth: \${badge(m.oauthConfigured, "Configurado", "Não configurado")}</p>
        <p class="muted">App \${esc(m.appId || "—")} · API \${esc(m.apiVersion || "—")} · Expira \${fmtDate(m.tokenExpiresAt)}</p>
        <div class="row">
          <button class="btn" data-act="meta-oauth">OAuth servidor (recomendado)</button>
          <button class="btn secondary" data-act="meta-sync">Sincronizar ativos</button>
          <button class="btn secondary" data-act="meta-refresh">Atualizar</button>
        </div>
      </div>
      <div id="meta-assets">\${assetsHtml}</div>\`);
    if (m.hasAccessToken) {
      const a = await api("/api/meta/assets");
      setHTML("meta-assets", renderAssetsBlock(a.body));
    } else {
      setHTML("meta-assets", '<div class="card"><p class="muted">Conecte sua conta Meta (OAuth) para listar business, Instagram, páginas, contas de anúncio e WhatsApp.</p></div>');
    }
  }

  async function renderAgents() {
    loading("tab-agents", "Agentes");
    const list = await api("/api/agents");
    const products = await api("/api/products");
    const items = (products.body && products.body.items) || [];
    const productOpts = items.length
      ? items.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join("")
      : '<option value="">— nenhum produto (use Seed em Produtos) —</option>';
    const agents = (list.body && list.body.items) || [];
    const agentCards = agents.map((a) =>
      '<div class="agent"><div class="agent-head"><strong>' + esc(a.name) + '</strong>' +
      '<span class="badge info">' + esc(a.riskProfile) + '</span></div>' +
      '<p class="muted">' + esc(a.description) + '</p>' +
      '<button class="btn secondary sm" data-act="run-agent" data-key="' + esc(a.key) + '">Executar agente</button></div>'
    ).join("");
    setHTML("tab-agents", \`
      <h2>Agentes IA</h2>
      <div class="card">
        <h3>Ciclo de marketing completo</h3>
        <label>Produto</label><select id="orch-product">\${productOpts}</select>
        <label>Objetivo</label><input id="orch-objective" value="Vender produto prioritário" />
        <label>Orçamento diário (R$)</label><input id="orch-budget" type="number" value="50" />
        <div class="row"><button class="btn" data-act="orchestrate">Executar ciclo completo</button></div>
        <pre id="orch-out" class="hidden"></pre>
      </div>
      <h3>Agentes individuais</h3>
      \${agentCards || '<div class="empty">Nenhum agente.</div>'}
      <pre id="agent-out" class="hidden"></pre>\`);
  }

  async function renderActions() {
    loading("tab-actions", "Auditoria");
    const r = await api("/api/agents/actions?limit=40");
    const rows = ((r.body && r.body.items) || []).map((a) => [
      esc(a.agentName), esc(a.actionType),
      '<span class="badge ' + (a.status === "SUCCESS" ? "ok" : (a.status === "BLOCKED" ? "warn" : "err")) + '">' + esc(a.status) + '</span>',
      esc(a.riskLevel), fmtDate(a.createdAt)
    ]);
    setHTML("tab-actions", '<h2>Auditoria de agentes</h2>' + tableHTML(["Agente","Ação","Status","Risco","Quando"], rows));
  }

  async function renderProducts() {
    loading("tab-products", "Produtos");
    const r = await api("/api/products");
    const rows = ((r.body && r.body.items) || []).map((p) => [
      esc(p.name), esc(p.brand || "—"), "R$ " + esc(p.price),
      esc(p.stockQuantity), '<span class="badge ' + (p.status === "ACTIVE" ? "ok" : "warn") + '">' + esc(p.status) + '</span>'
    ]);
    setHTML("tab-products", '<h2>Produtos</h2><div class="row" style="margin-bottom:1rem"><button class="btn secondary" data-act="seed">Criar catálogo padrão</button></div>' + tableHTML(["Nome","Marca","Preço","Estoque","Status"], rows));
  }

  async function renderConversations() {
    loading("tab-conversations", "Conversas");
    const r = await api("/api/conversations");
    const rows = ((r.body && r.body.items) || []).map((c) => {
      const last = (c.messages && c.messages[0] && c.messages[0].content) || "—";
      const name = (c.lead && (c.lead.name || c.lead.phone || c.lead.instagramHandle)) || "Lead";
      return [
        '<span class="badge ' + (c.channel === "whatsapp" ? "ok" : "info") + '">' + esc(c.channel) + '</span>',
        esc(name), esc(last),
        '<span class="badge warn">' + esc(c.lead && c.lead.temperature) + '</span>', fmtDate(c.updatedAt)
      ];
    });
    setHTML("tab-conversations", '<h2>Conversas</h2><p class="muted"><a href="/tools/leads" target="_blank">Abrir CRM completo</a></p>' + tableHTML(["Canal","Contato","Última mensagem","Temp.","Atualizado"], rows));
  }

  async function renderLeads() {
    loading("tab-leads", "Leads CRM");
    const stats = await api("/api/leads/stats/summary");
    const list = await api("/api/leads?limit=50");
    const s = stats.body || {};
    const statCards = \`<div class="grid" style="margin-bottom:1rem">
      <div class="stat"><strong>\${s.total||0}</strong><span>Total</span></div>
      <div class="stat"><strong>\${s.hot||0}</strong><span>Quentes</span></div>
      <div class="stat"><strong>\${s.warm||0}</strong><span>Mornos</span></div>
      <div class="stat"><strong>\${s.cold||0}</strong><span>Frios</span></div>
      <div class="stat"><strong>\${s.awaitingHuman||0}</strong><span>Aguardando humano</span></div>
    </div>\`;
    const rows = ((list.body && list.body.items) || []).map((l) => [
      esc(l.name || "—"), esc(l.phone || l.instagramHandle || "—"),
      '<span class="badge warn">' + esc(l.temperature) + '</span>',
      '<span class="badge info">' + esc(l.status) + '</span>', fmtDate(l.updatedAt)
    ]);
    setHTML("tab-leads", '<h2>Leads CRM</h2>' + statCards + tableHTML(["Nome","Contato","Temp.","Status","Atualizado"], rows));
  }

  function renderRaw() {
    setHTML("tab-raw", \`
      <h2>API Raw</h2>
      <div class="card">
        <label>Path (ex: /api/platform/overview)</label>
        <input id="raw-path" value="/api/platform/overview" />
        <label>Body JSON</label>
        <textarea id="raw-body">{}</textarea>
        <div class="row">
          <button class="btn" data-act="raw" data-method="GET">GET</button>
          <button class="btn secondary" data-act="raw" data-method="POST">POST</button>
        </div>
        <pre id="raw-out">{}</pre>
      </div>\`);
  }

  // ===== Event delegation (robusto: funciona mesmo após re-render) =====
  document.addEventListener("click", async (ev) => {
    const tabBtn = ev.target.closest && ev.target.closest("nav button[data-tab]");
    if (tabBtn) { selectTab(tabBtn.dataset.tab); return; }

    const actBtn = ev.target.closest && ev.target.closest("[data-act]");
    if (!actBtn) return;
    const act = actBtn.dataset.act;

    if (act === "meta-oauth") return void openMetaOAuthServer();
    if (act === "meta-refresh") return void renderMeta();
    if (act === "meta-sync") {
      actBtn.disabled = true;
      const r = await api("/api/meta/sync-assets", { method: "POST" });
      actBtn.disabled = false;
      alert(r.ok ? "Ativos sincronizados." : "Erro: " + ((r.body && r.body.error) || r.status));
      return void renderMeta();
    }
    if (act === "seed") {
      actBtn.disabled = true;
      await api("/api/products/seed/default", { method: "POST" });
      actBtn.disabled = false;
      return void renderProducts();
    }
    if (act === "orchestrate") {
      const out = $("orch-out"); out.classList.remove("hidden"); out.textContent = "Executando ciclo…";
      const r = await api("/api/agents/orchestrate", {
        method: "POST",
        body: JSON.stringify({
          productId: $("orch-product").value,
          objective: $("orch-objective").value,
          maxDailyBudget: Number($("orch-budget").value),
          campaignType: "messages"
        })
      });
      out.textContent = JSON.stringify(r.body, null, 2);
      return;
    }
    if (act === "run-agent") {
      const key = actBtn.dataset.key;
      const out = $("agent-out"); out.classList.remove("hidden"); out.textContent = "Executando " + key + "…";
      const prod = $("orch-product") ? $("orch-product").value : "";
      const body = (key === "whatsappSales" || key === "instagramDirect")
        ? { channel: key === "whatsappSales" ? "whatsapp" : "instagram", conversationId: "demo", leadId: "demo", inboundText: "Quanto custa o iPhone?" }
        : { objective: "teste", productId: prod };
      const r = await api("/api/agents/" + key + "/run", { method: "POST", body: JSON.stringify(body) });
      out.textContent = JSON.stringify(r.body, null, 2);
      return;
    }
    if (act === "raw") {
      const method = actBtn.dataset.method;
      const opts = { method };
      if (method === "POST") opts.body = $("raw-body").value;
      const r = await api($("raw-path").value, opts);
      $("raw-out").textContent = JSON.stringify(r, null, 2);
      return;
    }
  });

  async function afterLogin() {
    const s = await loadSession();
    if (!s) return;
    window.__phoenixSession = s;
    selectTab("overview");
  }

  $("btn-login").onclick = async () => {
    const r = await auth.loginWithPassword($("login-email").value, $("login-password").value);
    if (r.ok) afterLogin();
    else alert("Login falhou: " + ((r.body && r.body.error) || r.status));
  };
  $("btn-login-key").onclick = async () => {
    const key = $("login-apikey").value.trim();
    if (!key) return alert("Informe a API Key");
    const r = await auth.loginWithApiKey(key);
    if (r.ok) afterLogin();
    else alert("API Key inválida");
  };
  $("btn-logout").onclick = () => {
    auth.clearSession();
    showApp(false);
    $("user-label").textContent = "Não autenticado";
  };

  $("login-email").value = cfg.adminEmail || "";
  $("login-apikey").value = cfg.adminApiKey || auth.getApiKey() || "";
  if (cfg.isDev && cfg.adminPassword) {
    $("btn-fill-local").classList.remove("hidden");
    $("btn-fill-local").onclick = () => {
      $("login-password").value = cfg.adminPassword;
      if (cfg.adminApiKey) $("login-apikey").value = cfg.adminApiKey;
    };
  }

  if (auth.getToken() || auth.getApiKey()) {
    loadSession().then((s) => { if (s) { window.__phoenixSession = s; selectTab("overview"); } });
  }
})();
`;
