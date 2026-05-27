import type { Express } from "express";

const LEADS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phoenix — CRM Leads</title>
  <style>
    :root { --bg:#0f172a; --card:#1e293b; --col:#111827; --text:#e2e8f0; --muted:#94a3b8; --accent:#3b82f6; --ia:#8b5cf6; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
    header { padding:1rem 1.5rem; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem; }
    header a { color:#93c5fd; text-decoration:none; font-size:.9rem; }
    .auth-bar { padding:.6rem 1.5rem; background:#1e293b; border-bottom:1px solid #334155; font-size:.85rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem; }
    .auth-bar input { padding:.35rem .5rem; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; max-width:12rem; }
    .auth-bar .row { display:flex; gap:.35rem; align-items:center; flex-wrap:wrap; }
    main { padding:1rem 1.25rem 2rem; overflow-x:auto; }
    .board { display:flex; gap:.75rem; align-items:flex-start; min-height:70vh; }
    .column { flex:0 0 260px; background:var(--col); border-radius:10px; border:1px solid #334155; max-height:calc(100vh - 180px); display:flex; flex-direction:column; }
    .column h2 { margin:0; padding:.75rem; font-size:.85rem; border-bottom:1px solid #334155; display:flex; justify-content:space-between; }
    .column h2 span { background:#334155; padding:2px 8px; border-radius:99px; font-size:.75rem; }
    .cards { padding:.5rem; overflow-y:auto; flex:1; }
    .card { background:var(--card); border:1px solid #475569; border-radius:8px; padding:.65rem; margin-bottom:.5rem; cursor:pointer; }
    .card:hover { border-color:var(--accent); }
    .card strong { display:block; font-size:.9rem; }
    .card .preview { color:var(--muted); font-size:.78rem; margin:.35rem 0; line-height:1.3; max-height:2.6em; overflow:hidden; }
    .card .meta { font-size:.7rem; color:var(--muted); display:flex; justify-content:space-between; gap:.25rem; }
    .badge-ia { background:#4c1d95; color:#ddd6fe; font-size:.65rem; padding:1px 6px; border-radius:4px; }
    .badge-hot { background:#450a0a; color:#fca5a5; }
    .badge-warm { background:#451a03; color:#fcd34d; }
    button { padding:.4rem .75rem; border-radius:6px; border:none; background:var(--accent); color:#fff; cursor:pointer; font:inherit; }
    button.secondary { background:#475569; }
    #detail-panel { position:fixed; right:0; top:0; width:min(360px,95vw); height:100vh; background:#1e293b; border-left:1px solid #334155; padding:1rem; transform:translateX(100%); transition:transform .2s; overflow:auto; z-index:10; }
    #detail-panel.open { transform:translateX(0); }
    #detail-panel pre { font-size:.72rem; background:#020617; padding:.75rem; border-radius:8px; overflow:auto; }
    .muted { color:var(--muted); }
    .err { color:#fca5a5; }
  </style>
</head>
<body>
  <header>
    <div>
      <a href="/">← Centro de ferramentas</a>
      <h1 style="margin:.35rem 0 0">CRM — Pipeline (estilo Trello)</h1>
    </div>
    <button type="button" id="btn-refresh">Atualizar</button>
  </header>
  <div class="auth-bar" id="auth-bar">
    <span id="auth-status" class="muted">Verificando sessão…</span>
    <div class="row">
      <input id="auth-api-key" type="text" placeholder="x-api-key" />
      <button type="button" class="secondary" id="btn-auth-key">Entrar com API Key</button>
      <a href="/console" class="muted">ou login no Console</a>
    </div>
  </div>
  <main>
    <p class="muted" style="margin-top:0">Cards alimentados automaticamente pela IA via webhooks WhatsApp/Instagram.</p>
    <div id="board" class="board"></div>
  </main>
  <aside id="detail-panel">
    <button type="button" class="secondary" id="btn-close-detail" style="margin-bottom:.75rem">Fechar</button>
    <div id="detail-content"></div>
  </aside>
  <script src="/shared/auth.js"></script>
  <script src="/tools/leads.js"></script>
</body>
</html>`;

const LEADS_JS = `
(function () {
  const $ = (id) => document.getElementById(id);
  const auth = window.PhoenixAuth;

  const STATUS_BY_COLUMN = {
    novo: { status: "novo", temperature: "COLD" },
    qualificando: { status: "qualificando", temperature: "WARM" },
    quente: { status: "lead_quente", temperature: "HOT" },
    humano: { status: "aguardando_humano", temperature: "HOT" }
  };

  function label(l) {
    if (l.name) return l.name;
    if (l.phone) return "+" + l.phone;
    if (l.instagramHandle) return "@" + l.instagramHandle;
    return l.id.slice(0, 8);
  }

  function lastPreview(lead) {
    const conv = lead.conversations && lead.conversations[0];
    const msg = conv && conv.messages && conv.messages[0];
    return msg ? msg.content : (lead.nextAction || "Sem mensagens");
  }

  function isAiFed(lead) {
    return lead.status === "qualificando" || lead.nextAction?.includes("automática") || lead.nextAction?.includes("qualificação");
  }

  async function refreshAuthBar() {
    const me = await auth.loadMe();
    if (me.ok) {
      $("auth-status").innerHTML = "Autenticado: <strong>" + (me.body.user?.email || "operador") + "</strong>";
      $("auth-bar").querySelector(".row").style.display = "none";
      return true;
    }
    $("auth-status").innerHTML = '<span class="err">Não autenticado</span> — use API Key ou <a href="/console">Console</a>';
    $("auth-bar").querySelector(".row").style.display = "flex";
    const savedKey = auth.getApiKey();
    if (savedKey) $("auth-api-key").value = savedKey;
    return false;
  }

  function renderBoard(data) {
    const board = $("board");
    board.innerHTML = "";
    (data.columns || []).forEach((col) => {
      const colEl = document.createElement("div");
      colEl.className = "column";
      colEl.dataset.columnId = col.id;
      colEl.innerHTML = "<h2>" + col.title + " <span>" + col.items.length + "</span></h2><div class='cards'></div>";
      const cardsEl = colEl.querySelector(".cards");
      col.items.forEach((lead) => {
        const card = document.createElement("div");
        card.className = "card";
        card.draggable = true;
        card.dataset.leadId = lead.id;
        const tempClass = lead.temperature === "HOT" ? "badge-hot" : lead.temperature === "WARM" ? "badge-warm" : "";
        card.innerHTML =
          "<strong>" + label(lead) + "</strong>" +
          (isAiFed(lead) ? " <span class='badge-ia'>IA</span>" : "") +
          "<p class='preview'>" + lastPreview(lead) + "</p>" +
          "<div class='meta'><span>" + lead.source + "</span><span class='" + tempClass + "'>" + lead.temperature + "</span></div>";
        card.onclick = () => openDetail(lead.id);
        card.ondragstart = (e) => { e.dataTransfer.setData("leadId", lead.id); };
        cardsEl.appendChild(card);
      });
      colEl.ondragover = (e) => e.preventDefault();
      colEl.ondrop = async (e) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData("leadId");
        if (!leadId) return;
        const target = STATUS_BY_COLUMN[col.id];
        if (!target) return;
        await auth.api("/api/leads/" + leadId, {
          method: "PATCH",
          body: JSON.stringify({ status: target.status, temperature: target.temperature })
        });
        loadBoard();
      };
      board.appendChild(colEl);
    });
  }

  async function openDetail(leadId) {
    const r = await auth.api("/api/leads/" + leadId);
    $("detail-content").innerHTML = "<h3>Lead</h3><pre>" + JSON.stringify(r.body, null, 2) + "</pre>";
    $("detail-panel").classList.add("open");
  }

  async function loadBoard() {
    const authed = await refreshAuthBar();
    if (!authed && !auth.getApiKey() && !auth.getToken()) {
      $("board").innerHTML = "<p class='err'>Faça login para ver o pipeline.</p>";
      return;
    }
    const r = await auth.api("/api/leads/board");
    if (!r.ok) {
      $("board").innerHTML = "<p class='err'>Erro " + r.status + " ao carregar board.</p>";
      return;
    }
    renderBoard(r.body);
  }

  $("btn-refresh").onclick = loadBoard;
  $("btn-close-detail").onclick = () => $("detail-panel").classList.remove("open");
  $("btn-auth-key").onclick = async () => {
    const key = $("auth-api-key").value.trim();
    if (!key) return alert("Informe a API Key");
    const r = await auth.loginWithApiKey(key);
    if (r.ok) loadBoard();
    else alert("API Key inválida");
  };

  loadBoard();
  setInterval(loadBoard, 12000);
})();
`;

export function registerBrowserLeadsRoutes(app: Express): void {
  app.get(["/tools/leads", "/tools/leads/"], (_req, res) => {
    res.type("html").send(LEADS_HTML);
  });
  app.get("/tools/leads.js", (_req, res) => {
    res.type("application/javascript").send(LEADS_JS);
  });
}
