import type { Express } from "express";

const HUB_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phoenix — Centro de Ferramentas</title>
  <style>
    :root { --bg:#0b1220; --card:#1a2332; --text:#e8eef7; --muted:#8b9cb3; --accent:#3b82f6; --border:#2d3a4f; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
    header { padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); }
    header h1 { margin:0 0 .25rem; font-size:1.35rem; }
  header p { margin:0; color:var(--muted); font-size:.95rem; }
    main { max-width:56rem; margin:0 auto; padding:1.5rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:1rem; }
    a.card { display:block; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.1rem 1.2rem; text-decoration:none; color:inherit; transition:border-color .15s,transform .15s; }
    a.card:hover { border-color:var(--accent); transform:translateY(-2px); }
    a.card h2 { margin:0 0 .35rem; font-size:1rem; }
    a.card p { margin:0; color:var(--muted); font-size:.85rem; line-height:1.4; }
    .tag { display:inline-block; margin-top:.6rem; font-size:.7rem; padding:2px 8px; border-radius:99px; background:#1e3a5f; color:#93c5fd; }
    footer { text-align:center; padding:2rem; color:var(--muted); font-size:.8rem; }
    footer a { color:#93c5fd; }
  </style>
</head>
<body>
  <header>
    <h1>Phoenix Global Market Automat</h1>
    <p>Backend unificado — escolha a ferramenta no menu abaixo.</p>
  </header>
  <main>
    <div class="grid">
      <a class="card" href="/console">
        <h2>Console operacional</h2>
        <p>Login, visão geral, Meta OAuth, agentes IA, produtos, conversas e API raw.</p>
        <span class="tag">Principal</span>
      </a>
      <a class="card" href="/tools/emulator">
        <h2>Emulador de webhooks</h2>
        <p>Simular WhatsApp e Instagram, testar health, auth e assinatura HMAC.</p>
        <span class="tag">Testes</span>
      </a>
      <a class="card" href="/tools/leads">
        <h2>CRM — Leads</h2>
        <p>Pipeline de leads, temperatura, status e próxima ação comercial.</p>
        <span class="tag">Vendas</span>
      </a>
      <a class="card" href="/health" target="_blank" rel="noopener">
        <h2>Health check</h2>
        <p>Status da API, bootstrap e conexão com o banco.</p>
        <span class="tag">JSON</span>
      </a>
      <a class="card" href="/api/platform/health" target="_blank" rel="noopener">
        <h2>Platform health</h2>
        <p>Endpoint público da plataforma.</p>
        <span class="tag">JSON</span>
      </a>
      <a class="card" href="/api/agents/catalog" target="_blank" rel="noopener">
        <h2>Catálogo de agentes</h2>
        <p>Lista pública dos agentes IA (sem autenticação).</p>
        <span class="tag">JSON</span>
      </a>
    </div>
    <p id="hub-auth" class="muted" style="margin-top:1.25rem;text-align:center"></p>
  </main>
  <footer>
    API REST em <code>/api/*</code> · Webhooks <code>/webhooks/*</code> ·
    <a href="/console">Entrar no console</a>
  </footer>
  <script src="/shared/auth.js"></script>
  <script>
    (async function () {
      const el = document.getElementById("hub-auth");
      if (!window.PhoenixAuth) return;
      const me = await PhoenixAuth.loadMe();
      if (me.ok) {
        el.innerHTML = "Sessão ativa: <strong>" + (me.body.user?.email || "operador") + "</strong> — CRM e console compartilham o mesmo login.";
      } else {
        el.innerHTML = "Não autenticado — <a href='/console'>faça login no Console</a> ou use API Key no CRM.";
      }
    })();
  </script>
</body>
</html>`;

export function registerBrowserHubRoutes(app: Express): void {
  app.get(["/", "/hub", "/hub/"], (_req, res) => {
    res.type("html").send(HUB_HTML);
  });
}
