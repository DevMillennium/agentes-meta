/**
 * Tenta configurar Valid OAuth Redirect URIs no Meta Developer (requer sessão Facebook ativa).
 * Uso: node scripts/meta-oauth-redirect-playwright.mjs
 */
import { chromium } from 'playwright';
import { homedir } from 'os';
import { join } from 'path';

const APP_ID = process.env.META_APP_ID || '27447238071580159';
const PUBLIC = process.env.PHOENIX_CHATWOOT_PUBLIC_URL || 'https://adam-transmitted-glasgow-rent.trycloudflare.com';
const REDIRECTS = [
  `${PUBLIC}/`,
  'http://localhost:3001/',
  'https://phoenix-marketing-api.vercel.app/api/meta/oauth/callback',
];

const SETTINGS_URL = `https://developers.facebook.com/apps/${APP_ID}/fb-login/settings/`;
const chromeUserData = join(homedir(), 'Library/Application Support/Google/Chrome');

async function main() {
  let context;
  try {
    context = await chromium.launchPersistentContext(chromeUserData, {
      channel: 'chrome',
      headless: false,
      args: ['--profile-directory=Default'],
    });
  } catch {
    context = await chromium.launchPersistentContext(join(homedir(), '.phoenix-playwright-meta'), {
      headless: false,
    });
  }

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(SETTINGS_URL, { waitUntil: 'networkidle', timeout: 120000 });

  if (page.url().includes('login')) {
    console.log('LOGIN_REQUIRED: faça login no Facebook Developer e rode o script novamente.');
    await context.close();
    process.exit(2);
  }

  const textarea = page.locator('textarea').filter({ hasText: /redirect|uri/i }).first();
  const fallback = page.locator('input[type="text"]').nth(0);

  let target = textarea;
  if ((await textarea.count()) === 0) {
    target = page.locator('textarea').first();
  }

  await target.waitFor({ timeout: 60000 });
  const current = await target.inputValue().catch(() => '');
  const lines = new Set(
    current
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  REDIRECTS.forEach((u) => lines.add(u));
  await target.fill([...lines].join('\n'));

  const save = page.getByRole('button', { name: /save|salvar/i }).first();
  if ((await save.count()) > 0) {
    await save.click();
    await page.waitForTimeout(3000);
  }

  console.log('OAUTH_REDIRECTS_SAVED:', [...lines].join(' | '));
  await context.close();
}

main().catch((e) => {
  console.error('PLAYWRIGHT_FAILED:', e.message);
  process.exit(1);
});
