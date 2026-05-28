/**
 * Automação navegador: Meta Console (Chrome do usuário) + OAuth (API JWT).
 * Login Phoenix via API (evita proteção Vercel/Google no web).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, ".env") });

const isCloud = process.env.PHOENIX_TARGET !== "local";
const META_APP_ID = process.env.META_APP_ID?.trim() || "27447238071580159";
const META_BUSINESS_ID = process.env.META_BUSINESS_ID?.trim() || "1078327696794532";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? "";
const API_URL = (
  isCloud
    ? process.env.PHOENIX_CLOUD_API_URL ?? "https://phoenix-marketing-api.vercel.app"
    : process.env.API_PUBLIC_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const WEB_URL = (
  isCloud
    ? process.env.PHOENIX_CLOUD_WEB_URL ??
      "https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app"
    : process.env.WEB_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const CDP_URL = (process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222").replace(/\/$/, "");
const ADVANCED_URL = `https://developers.facebook.com/apps/${META_APP_ID}/settings/advanced/?business_id=${META_BUSINESS_ID}`;
const FB_LOGIN_URL = `https://developers.facebook.com/apps/${META_APP_ID}/fb-login/settings/?business_id=${META_BUSINESS_ID}`;
const OAUTH_TIMEOUT_MS = Number(process.env.META_OAUTH_TIMEOUT_MS ?? 300_000);

const REDIRECT_URIS = [
  "https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback",
  "https://phoenix-marketing-api-millenniumomnichannel-4893s-projects.vercel.app/api/meta/oauth/callback",
  "http://localhost:4000/api/meta/oauth/callback",
  "http://127.0.0.1:4000/api/meta/oauth/callback"
].join("\n");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function isCdpAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function openChromeTab(url: string): Promise<void> {
  const escaped = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  await execFileAsync("osascript", [
    "-e",
    `tell application "Google Chrome"
      activate
      if (count of windows) = 0 then make new window
      tell front window
        make new tab with properties {URL:"${escaped}"}
      end tell
    end tell`
  ]);
}

async function apiLogin(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const data = (await res.json()) as { accessToken?: string; error?: string };
  if (!res.ok || !data.accessToken) {
    throw new Error(data.error ?? `Login API falhou (${res.status})`);
  }
  console.log("✓ Login Phoenix via API");
  return data.accessToken;
}

async function fetchOAuthUrl(jwt: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/meta/oauth/login-url`, {
    headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" }
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "URL OAuth indisponível");
  return data.url;
}

async function hasMetaToken(jwt: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/meta/status`, {
    headers: { authorization: `Bearer ${jwt}` }
  });
  const data = (await res.json()) as { hasAccessToken?: boolean };
  return Boolean(data.hasAccessToken);
}

async function approveFacebook(page: Page): Promise<void> {
  for (const pattern of [/continuar como|continue as/i, /permitir|allow|autorizar/i, /conectar|connect|ok|confirmar/i]) {
    const btn = page.getByRole("button", { name: pattern }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ timeout: 5000 }).catch(() => undefined);
      await sleep(1200);
    }
  }
}

async function configureMetaWithCdp(): Promise<void> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Sem contexto CDP");

  const page = await context.newPage();
  console.log("→ Meta Avançado: alterar tipo para WEB");
  await page.goto(ADVANCED_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await sleep(5000);

  for (const sel of page.locator("select")) {
    const n = await page.locator("select").count();
    for (let i = 0; i < n; i++) {
      const s = page.locator("select").nth(i);
      const html = await s.innerHTML().catch(() => "");
      if (!/web|desktop|native/i.test(html)) continue;
      try {
        await s.selectOption({ label: /^web$/i });
        console.log("✓ Select → Web");
      } catch {
        /* ignore */
      }
    }
    break;
  }

  const webRadio = page.getByRole("radio", { name: /^web$/i }).first();
  if (await webRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
    await webRadio.check().catch(() => undefined);
    console.log("✓ Radio Web");
  }

  const save = page.getByRole("button", { name: /salvar|save/i }).first();
  if (await save.isVisible({ timeout: 2000 }).catch(() => false)) await save.click();
  await sleep(3000);

  console.log("→ Meta Facebook Login: URIs OAuth");
  await page.goto(FB_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await sleep(3000);

  const ta = page.locator("textarea").first();
  if (await ta.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ta.fill(REDIRECT_URIS);
    console.log("✓ URIs preenchidas");
  }

  for (const name of [/web oauth|oauth na web/i, /client oauth|oauth do cliente/i]) {
    const cb = page.getByRole("checkbox", { name }).first();
    if (await cb.isVisible({ timeout: 1500 }).catch(() => false) && !(await cb.isChecked().catch(() => true))) {
      await cb.check().catch(() => undefined);
    }
  }

  if (await save.isVisible({ timeout: 2000 }).catch(() => false)) await save.click();
  await browser.close();
}

async function runOAuthCdp(oauthUrl: string, jwt: string): Promise<void> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Sem contexto CDP");
  const page = await context.newPage();
  await page.goto(oauthUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });

  const deadline = Date.now() + OAUTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await hasMetaToken(jwt)) {
      console.log("✓ Token Meta conectado");
      await browser.close();
      return;
    }
    const body = await page.content();
    if (/desktop app|configured as a desktop/i.test(body)) {
      await browser.close();
      throw new Error("App Meta ainda é Desktop — salve tipo WEB em Avançado e rode de novo.");
    }
    if (/Meta conectado|conectada com sucesso/i.test(body)) {
      await sleep(2000);
      if (await hasMetaToken(jwt)) {
        await browser.close();
        return;
      }
    }
    await approveFacebook(page);
    await sleep(1500);
  }
  await browser.close();
  throw new Error("Timeout OAuth — clique Continuar/Permitir no Chrome.");
}

async function runOAuthAppleScript(oauthUrl: string, jwt: string): Promise<void> {
  await openChromeTab(oauthUrl);
  console.log("⏳ Aba OAuth aberta — clique Continuar/Permitir no Facebook…");
  const deadline = Date.now() + OAUTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await hasMetaToken(jwt)) {
      console.log("✓ Token Meta conectado");
      return;
    }
    await sleep(2000);
  }
  throw new Error("Timeout OAuth.");
}

async function main(): Promise<void> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD no .env");

  console.log(`== Phoenix Meta — browser setup (${isCloud ? "NUVEM" : "LOCAL"}) ==\n`);

  const jwt = await apiLogin();

  console.log("→ Abrindo Meta Console no seu Chrome (sessão Facebook)…");
  await openChromeTab(ADVANCED_URL);
  await sleep(1);
  await openChromeTab(FB_LOGIN_URL);

  if (await isCdpAvailable()) {
    console.log("→ CDP ativo: configurando Meta automaticamente…");
    await configureMetaWithCdp();
  } else {
    console.log("⚠ CDP inativo. Cole URIs (Cmd+V) na aba Facebook Login e mude tipo para WEB em Avançado.");
    console.log("  Para CDP total: feche Chrome (Cmd+Q) e rode: bash scripts/chrome-cdp-hint.sh");
    await sleep(15_000);
  }

  if (await hasMetaToken(jwt)) {
    console.log("✓ Token Meta já existia");
    return;
  }

  const oauthUrl = await fetchOAuthUrl(jwt);
  console.log("→ Iniciando OAuth Meta…");

  if (await isCdpAvailable()) {
    await runOAuthCdp(oauthUrl, jwt);
  } else {
    await runOAuthAppleScript(oauthUrl, jwt);
  }

  await fetch(`${API_URL}/api/meta/sync-assets`, {
    method: "POST",
    headers: { authorization: `Bearer ${jwt}` }
  });

  const status = await (
    await fetch(`${API_URL}/api/meta/status`, { headers: { authorization: `Bearer ${jwt}` } })
  ).json();
  console.log("\n--- Status ---\n", JSON.stringify(status, null, 2));
  console.log(`\nPainel: ${WEB_URL}/configuracoes/meta`);
}

main().catch((e) => {
  console.error("\n✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
