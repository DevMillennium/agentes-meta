/**
 * Abre o Chatwoot no Chrome já autenticado (credenciais do bootstrap).
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env") });

const BASE = (process.env.CHATWOOT_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@phoenixglobal.com.br";
const PASSWORD = process.env.CHATWOOT_ADMIN_PASSWORD ?? "PhoenixGlobal123!";

async function waitForChatwoot(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok || res.status === 302) return;
    } catch {
      /* aguardando */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function completeOnboarding(page: import("playwright").Page): Promise<void> {
  if (!page.url().includes("/installation/onboarding")) return;

  const accountInput = page.locator('input[name="account_name"], #account_name').first();
  if (await accountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await accountInput.fill("Phoenix Global");
    const nameInput = page.locator('input[name="user_full_name"], #user_full_name').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill("Admin Phoenix");
    }
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(EMAIL);
    }
    const passInputs = page.locator('input[type="password"]');
    const count = await passInputs.count();
    for (let i = 0; i < count; i++) {
      await passInputs.nth(i).fill(PASSWORD);
    }
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForTimeout(3000);
  }
}

async function login(page: import("playwright").Page): Promise<void> {
  await page.goto(`${BASE}/app/login`, { waitUntil: "domcontentloaded", timeout: 60000 });

  if (page.url().includes("/app/accounts")) return;

  await completeOnboarding(page);

  if (page.url().includes("/app/accounts")) return;

  const emailSel = 'input[type="email"], input[name="email_address"], #email_address';
  const passSel = 'input[type="password"], input[name="password"], #password';

  if (!(await page.locator(emailSel).isVisible({ timeout: 8000 }).catch(() => false))) {
    return;
  }

  await page.fill(emailSel, EMAIL);
  await page.fill(passSel, PASSWORD);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForURL(/\/app\//, { timeout: 30000 }).catch(() => undefined);
}

async function main(): Promise<void> {
  await waitForChatwoot();

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome"
  });

  const page = await browser.newPage();
  await login(page);

  const accountId = process.env.CHATWOOT_ACCOUNT_ID ?? "1";
  const dashboard = `${BASE}/app/accounts/${accountId}/dashboard`;
  if (!page.url().includes("/app/accounts")) {
    await page.goto(dashboard, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await login(page);
  }

  if (!page.url().includes("/app/accounts")) {
    await page.goto(dashboard, { waitUntil: "domcontentloaded" });
  }

  console.log(`Chatwoot aberto: ${page.url()}`);
  console.log(`Login: ${EMAIL}`);

  await new Promise<void>(() => {
    /* mantém browser aberto */
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
