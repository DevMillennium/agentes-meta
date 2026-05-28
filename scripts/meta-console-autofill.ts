/**
 * Preenche URIs OAuth no Meta Developer (Facebook Login) via Chrome CDP ou Playwright.
 * Requer sessão Facebook já logada no Chrome.
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

const META_APP_ID = process.env.META_APP_ID?.trim() || "27447238071580159";
const META_BUSINESS_ID = process.env.META_BUSINESS_ID?.trim() || "1078327696794532";
const CDP_URL = (process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222").replace(/\/$/, "");
const FB_LOGIN_URL = `https://developers.facebook.com/apps/${META_APP_ID}/fb-login/settings/?business_id=${META_BUSINESS_ID}`;

const REDIRECT_URIS = [
  "https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback",
  "https://phoenix-marketing-api-millenniumomnichannel-4893s-projects.vercel.app/api/meta/oauth/callback",
  "http://localhost:4000/api/meta/oauth/callback",
  "http://127.0.0.1:4000/api/meta/oauth/callback"
].join("\n");

const JS_SDK_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app",
  "phoenix-marketing-web.vercel.app"
].join("\n");

async function isCdpAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startChromeWithCdp(): Promise<void> {
  const profile = process.env.CHROME_USER_DATA_DIR ?? `${process.env.HOME}/Library/Application Support/Google/Chrome`;
  console.log("→ Iniciando Chrome com CDP na porta 9222 (feche o Chrome com Cmd+Q antes, se falhar)…");
  execFile(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--remote-debugging-port=9222", `--user-data-dir=${profile}`],
    { detached: true }
  ).unref();
  for (let i = 0; i < 30; i++) {
    if (await isCdpAvailable()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Chrome CDP não respondeu na porta 9222.");
}

async function fillTextareas(page: Page, hints: RegExp[], value: string): Promise<boolean> {
  const areas = page.locator("textarea");
  const count = await areas.count();
  for (let i = 0; i < count; i++) {
    const area = areas.nth(i);
    const label =
      (await area.getAttribute("aria-label")) ??
      (await area.evaluate((el) => {
        const id = el.id;
        if (!id) return "";
        const lbl = document.querySelector(`label[for="${id}"]`);
        return lbl?.textContent ?? "";
      })) ??
      "";
    if (hints.some((h) => h.test(label))) {
      await area.fill(value);
      return true;
    }
  }
  return false;
}

async function clickSave(page: Page): Promise<void> {
  const save = page.getByRole("button", { name: /salvar|save|guardar/i }).first();
  if (await save.isVisible({ timeout: 3000 }).catch(() => false)) {
    await save.click();
    await page.waitForTimeout(2000);
  }
}

async function configureFbLogin(page: Page): Promise<void> {
  console.log(`→ Abrindo ${FB_LOGIN_URL}`);
  await page.goto(FB_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(3000);

  const toggles = [
    /login do oauth do cliente|client oauth login/i,
    /login do oauth na web|web oauth login/i,
    /forçar https|enforce https/i
  ];
  for (const name of toggles) {
    const toggle = page.getByRole("checkbox", { name }).first();
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      const checked = await toggle.isChecked().catch(() => true);
      if (!checked) await toggle.check().catch(() => undefined);
    }
  }

  const redirectFilled =
    (await fillTextareas(page, [/redirect|redirecionamento/i], REDIRECT_URIS)) ||
    (await page
      .locator('textarea[name*="redirect"], textarea[placeholder*="redirect"]')
      .first()
      .fill(REDIRECT_URIS)
      .then(() => true)
      .catch(() => false));

  const sdkFilled =
    (await fillTextareas(page, [/javascript|sdk|domínio/i], JS_SDK_DOMAINS)) ||
    (await page
      .locator('textarea[name*="sdk"], textarea[placeholder*="domain"]')
      .first()
      .fill(JS_SDK_DOMAINS)
      .then(() => true)
      .catch(() => false));

  console.log(redirectFilled ? "✓ URIs de redirect preenchidas" : "⚠ Campo redirect não encontrado — cole manualmente (Cmd+V)");
  console.log(sdkFilled ? "✓ Domínios SDK preenchidos" : "⚠ Campo SDK não encontrado");

  await clickSave(page);
  console.log("✓ Tentativa de salvar concluída — confira no Chrome e clique Salvar se necessário.");
}

async function main(): Promise<void> {
  let browser: Browser | null = null;
  let ownsBrowser = false;
  try {
    if (await isCdpAvailable()) {
      browser = await chromium.connectOverCDP(CDP_URL);
      const context = browser.contexts()[0];
      if (!context) throw new Error("Sem contexto Chrome via CDP.");
      const page = await context.newPage();
      await configureFbLogin(page);
      return;
    }

    console.log("→ Abrindo Chrome controlado (faça login no Facebook/Meta se pedir)…");
    browser = await chromium.launch({ headless: false, channel: "chrome" });
    ownsBrowser = true;
    const context = await browser.newContext();
    const page = await context.newPage();
    await configureFbLogin(page);
    console.log("→ Revise a janela do Chrome e confirme Salvar no Meta Console.");
    await page.waitForTimeout(60_000);
  } finally {
    if (browser && ownsBrowser) await browser.close();
    else if (browser) await browser.close();
  }
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
