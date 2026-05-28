import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { resolveScreenshotsDir, writeAgentLog } from "../shared/logger";

function getAllowedHosts(): string[] {
  const raw = (process.env.BROWSER_AGENT_ALLOWED_HOSTS ?? "business.facebook.com,developers.facebook.com")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return raw;
}

function assertUrlAllowed(targetUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error(`URL inválida: ${targetUrl}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Apenas URLs http/https são permitidas.");
  }

  const allowedHosts = getAllowedHosts();
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new Error(
      `Host não permitido (${parsed.hostname}). Defina BROWSER_AGENT_ALLOWED_HOSTS para autorizar.`
    );
  }
}

export class BrowserAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;

  public async start(): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  public async stop(): Promise<void> {
    if (!this.browser) return;
    await this.browser.close();
    this.browser = null;
    this.page = null;
  }

  private getPage(): Page {
    if (!this.page) {
      throw new Error("BrowserAgent não iniciado. Chame start() antes.");
    }
    return this.page;
  }

  public async openUrl(targetUrl: string): Promise<string> {
    assertUrlAllowed(targetUrl);
    const page = this.getPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const title = await page.title();
    writeAgentLog("browser-agent", "info", "Page opened", { targetUrl, title });
    return title;
  }

  public async click(selector: string): Promise<void> {
    const page = this.getPage();
    await page.click(selector, { timeout: 15_000 });
    writeAgentLog("browser-agent", "info", "Click performed", { selector });
  }

  public async fill(selector: string, value: string): Promise<void> {
    const page = this.getPage();
    await page.fill(selector, value, { timeout: 15_000 });
    writeAgentLog("browser-agent", "info", "Input filled", { selector });
  }

  public async extractText(selector: string): Promise<string> {
    const page = this.getPage();
    const text = (await page.textContent(selector, { timeout: 15_000 }))?.trim() ?? "";
    writeAgentLog("browser-agent", "info", "Text extracted", { selector, length: text.length });
    return text;
  }

  public async screenshot(fileName = `shot-${Date.now()}.png`): Promise<string> {
    const page = this.getPage();
    const safeFile = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const outputPath = path.join(resolveScreenshotsDir(), safeFile);
    await page.screenshot({ path: outputPath, fullPage: true });
    writeAgentLog("browser-agent", "info", "Screenshot captured", { outputPath });
    return outputPath;
  }
}

async function cli(): Promise<void> {
  const action = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv.slice(4).join(" ");
  const agent = new BrowserAgent();

  if (!action) {
    console.log(`Uso:
npm run agent:browser -- open <url>
npm run agent:browser -- screenshot <url> [arquivo.png]
npm run agent:browser -- extract <url> <seletor-css>`);
    process.exit(1);
  }

  try {
    await agent.start();

    if (action === "open") {
      if (!arg1) throw new Error("Informe a URL.");
      const title = await agent.openUrl(arg1);
      console.log(JSON.stringify({ ok: true, action, title }, null, 2));
      return;
    }

    if (action === "screenshot") {
      if (!arg1) throw new Error("Informe a URL.");
      await agent.openUrl(arg1);
      const output = await agent.screenshot(arg2 || undefined);
      console.log(JSON.stringify({ ok: true, action, output }, null, 2));
      return;
    }

    if (action === "extract") {
      if (!arg1 || !arg2) throw new Error("Informe URL e seletor CSS.");
      await agent.openUrl(arg1);
      const text = await agent.extractText(arg2);
      console.log(JSON.stringify({ ok: true, action, text }, null, 2));
      return;
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    writeAgentLog("browser-agent", "error", "Browser command failed", {
      action,
      error: message
    });
    console.error(`browser-agent error: ${message}`);
    process.exit(1);
  } finally {
    await agent.stop();
  }
}

if (require.main === module) {
  void cli();
}
