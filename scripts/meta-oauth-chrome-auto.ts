/**
 * Conecta token Meta via OAuth usando o Google Chrome JÁ ABERTO (sessão Facebook ativa).
 *
 * 1) Tenta CDP (Chrome com --remote-debugging-port=9222) para automação completa.
 * 2) Senão: abre nova aba no Chrome via AppleScript (perfil/sessão atual) e aguarda o token.
 *
 * Uso: npm run meta:oauth:auto
 * CDP: CHROME_CDP_URL=http://127.0.0.1:9222 (ver scripts/chrome-cdp-hint.sh)
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.cloud") });

const isCloud = process.env.PHOENIX_TARGET === "cloud";
const CLOUD_API_DEFAULT = "https://phoenix-marketing-api.vercel.app";
const CLOUD_WEB_DEFAULT =
  "https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app";
/** Em cloud, ignora API_PUBLIC_URL do .env local para não misturar com localhost. */
const API_URL = (
  isCloud
    ? process.env.PHOENIX_CLOUD_API_URL ?? CLOUD_API_DEFAULT
    : process.env.API_PUBLIC_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const WEB_URL = (
  isCloud
    ? process.env.PHOENIX_CLOUD_WEB_URL ?? CLOUD_WEB_DEFAULT
    : process.env.WEB_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const API_KEY = process.env.ADMIN_API_KEY?.trim() ?? "";
let bearerJwt: string | null = null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? "";
const CDP_URL = (process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222").replace(/\/$/, "");
const TOKEN_FILE = path.join(repoRoot, ".meta-token.local.json");
const OAUTH_TIMEOUT_MS = Number(process.env.META_OAUTH_TIMEOUT_MS ?? 180_000);

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (bearerJwt) {
    headers.authorization = `Bearer ${bearerJwt}`;
  } else if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }
  return headers;
}

async function apiJson<T>(
  method: string,
  route: string,
  body?: unknown
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_URL}${route}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(1500);
  }
  throw new Error(`API offline em ${API_URL}. Rode: npm run dev`);
}

async function isCdpAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Abre OAuth numa nova aba do Chrome já em execução (mesmo perfil / cookies do Facebook). */
async function openOAuthTabInRunningChrome(oauthUrl: string): Promise<void> {
  const escaped = oauthUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then
    make new window
  end if
  tell front window
    make new tab with properties {URL:"${escaped}"}
  end tell
end tell
`;
  await execFileAsync("osascript", ["-e", script]);
  console.log("✓ Nova aba OAuth aberta no Chrome (sessão atual / já autenticada)");
}

async function hasMetaTokenConnected(): Promise<boolean> {
  const status = await apiJson<{ hasAccessToken?: boolean }>("GET", "/api/meta/status");
  if (status.data.hasAccessToken) return true;

  if (isCloud) return false;

  try {
    if (!fs.existsSync(TOKEN_FILE)) return false;
    const raw = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as { accessToken?: string };
    return Boolean(raw.accessToken?.trim());
  } catch {
    return false;
  }
}

async function waitForOAuthCompletion(): Promise<void> {
  const started = Date.now();
  let prompted = false;

  while (Date.now() - started < OAUTH_TIMEOUT_MS) {
    if (await hasMetaTokenConnected()) {
      console.log("✓ Token Meta detectado no backend");
      return;
    }

    if (!prompted) {
      console.log(
        "⏳ No Chrome aberto: clique Continuar/Permitir no Facebook (sessão já logada)…"
      );
      prompted = true;
    }
    await sleep(2000);
  }

  throw new Error(
    `Timeout (${OAUTH_TIMEOUT_MS / 1000}s) aguardando token.\n` +
      `No Chrome: abra a aba do Facebook e clique Continuar/Permitir.\n` +
      `Se aparecer "URL bloqueada", rode: npm run meta:fix-oauth-redirect e salve as URIs no Meta Console.`
  );
}

async function approveOAuthIfNeeded(page: Page): Promise<void> {
  const labels = [
    /continuar como/i,
    /continue as/i,
    /permitir|allow|autorizar|authorize/i,
    /conectar|connect|ok|confirmar|confirm/i
  ];
  for (const pattern of labels) {
    const btn = page.getByRole("button", { name: pattern }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ timeout: 5000 }).catch(() => undefined);
      await sleep(1200);
    }
  }
}

async function runOAuthViaCdp(oauthUrl: string): Promise<void> {
  console.log(`→ Conectando ao Chrome existente via CDP (${CDP_URL})…`);
  let browser: Browser | null = null;

  try {
    browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("Nenhum contexto Chrome encontrado via CDP.");
    }

    const page = await context.newPage();
    console.log("→ Abrindo OAuth na nova aba (mesmo perfil do Chrome)…");
    await page.goto(oauthUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const deadline = Date.now() + OAUTH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await hasMetaTokenConnected()) {
        console.log("✓ Token Meta salvo");
        return;
      }

      const url = page.url();
      if (url.includes("/api/meta/oauth/callback")) {
        const html = await page.content();
        if (/Meta conectado|conta Meta conectada/i.test(html)) {
          console.log("✓ Página de callback: sucesso");
          await sleep(1500);
          if (await hasMetaTokenConnected()) return;
        }
        if (/Erro OAuth/i.test(html)) {
          throw new Error("Meta retornou erro no callback OAuth.");
        }
      }

      await approveOAuthIfNeeded(page);
      await sleep(1200);
    }

    throw new Error("Timeout OAuth via CDP.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function runOAuthInExistingChrome(oauthUrl: string): Promise<void> {
  if (await isCdpAvailable()) {
    await runOAuthViaCdp(oauthUrl);
    return;
  }

  console.log("→ Modo AppleScript: usa o Chrome já aberto (sem fechar janelas)");
  await openOAuthTabInRunningChrome(oauthUrl);
  await waitForOAuthCompletion();
}

async function ensurePhoenixUser(): Promise<void> {
  const login = await apiJson<{ accessToken?: string; user?: { userId: string } }>(
    "POST",
    "/api/auth/login",
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  );
  if (login.status === 200 && login.data.accessToken) {
    bearerJwt = login.data.accessToken;
    console.log(
      `✓ Usuário Phoenix (${isCloud ? "nuvem/Postgres" : "local"}): ${login.data.user?.userId ?? ADMIN_EMAIL}`
    );
    return;
  }
  throw new Error(
    `Login Phoenix falhou (${login.status}). Verifique ADMIN_EMAIL/ADMIN_PASSWORD e DATABASE_URL na Vercel.`
  );
}

async function main(): Promise<void> {
  if (!isCloud && !API_KEY) throw new Error("ADMIN_API_KEY ausente no .env");
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios no .env");
  }

  console.log(
    `== Phoenix Meta OAuth — Chrome já autenticado (${isCloud ? "NUVEM" : "LOCAL"}) ==`
  );
  await waitForHealth();
  console.log(`✓ API online: ${API_URL}`);

  await ensurePhoenixUser();
  if (isCloud) {
    console.log("→ Nuvem: token Meta será persistido no Postgres (usuário JWT)");
  }

  if (!(await hasMetaTokenConnected())) {
    const loginUrl = await apiJson<{ url?: string; error?: string }>(
      "GET",
      "/api/meta/oauth/login-url"
    );
    if (loginUrl.status !== 200 || !loginUrl.data.url) {
      throw new Error(loginUrl.data.error ?? "Não foi possível gerar URL OAuth.");
    }
    await runOAuthInExistingChrome(loginUrl.data.url);
  } else {
    console.log("✓ Token Meta já conectado");
  }

  const sync = await apiJson<Record<string, unknown>>("POST", "/api/meta/sync-assets");
  if (sync.status >= 400) {
    console.warn("⚠ sync-assets:", JSON.stringify(sync.data));
  } else {
    console.log("✓ Ativos Meta sincronizados");
  }

  const bootstrap = await apiJson<Record<string, unknown>>("POST", "/api/meta/bootstrap");
  console.log(
    bootstrap.data.ok ? "✓ Bootstrap Meta OK" : "⚠ Bootstrap com pendências:",
    JSON.stringify(
      (bootstrap.data as { readinessAfter?: { missing?: string[] } }).readinessAfter?.missing ??
        bootstrap.data
    )
  );

  const status = await apiJson<{
    hasAccessToken?: boolean;
    marketingReady?: boolean;
    pageId?: string | null;
    adAccountId?: string | null;
  }>("GET", "/api/meta/status");

  const hasToken = status.data.hasAccessToken ?? (await hasMetaTokenConnected());
  if (!hasToken) {
    if (isCloud) {
      throw new Error(
        "Token Meta não persistido na nuvem. Salve URIs OAuth no Meta Console e refaça o fluxo."
      );
    }
    if (!fs.existsSync(TOKEN_FILE)) {
      throw new Error("Token Meta não persistido após OAuth.");
    }
  }

  console.log("\n--- Status final ---");
  console.log(
    JSON.stringify(
      {
        target: isCloud ? "cloud" : "local",
        apiUrl: API_URL,
        hasAccessToken: hasToken,
        marketingReady: status.data.marketingReady,
        pageId: status.data.pageId,
        adAccountId: status.data.adAccountId,
        tokenFile: !isCloud && fs.existsSync(TOKEN_FILE) ? TOKEN_FILE : null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error);
  process.exit(1);
});
