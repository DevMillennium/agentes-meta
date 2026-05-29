/**
 * Sincroniza token Meta + ativos descobertos para o .env (a partir dos arquivos locais da API).
 * Uso: npx tsx scripts/sync-env-meta.ts
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const tokenPath = path.join(root, ".meta-token.local.json");
const assetsPath = path.join(root, ".meta-assets.local.json");

type MetaAssets = {
  adAccountId?: string;
  pageId?: string;
  instagramBusinessAccountId?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
};

type StoredToken = { accessToken?: string };

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function upsertEnv(updates: Record<string, string>): string[] {
  let lines: string[] = [];
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf8").split("\n");
  }

  const touched = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Z0-9_]+)=/);
    if (!m) continue;
    const key = m[1];
    if (!(key in updates)) continue;
    const val = updates[key];
    lines[i] = `${key}=${val.includes(" ") ? `"${val}"` : val}`;
    touched.add(key);
  }

  for (const [key, val] of Object.entries(updates)) {
    if (touched.has(key)) continue;
    lines.push(`${key}=${val.includes(" ") ? `"${val}"` : val}`);
  }

  const out = lines.filter((l, i, arr) => !(i === arr.length - 1 && l === "")).join("\n") + "\n";
  fs.writeFileSync(envPath, out);
  return Object.keys(updates);
}

function main(): void {
  const updates: Record<string, string> = {};

  const token = readJson<StoredToken>(tokenPath);
  if (token?.accessToken?.trim()) {
    updates.META_ACCESS_TOKEN = token.accessToken.trim();
  }

  const assets = readJson<MetaAssets>(assetsPath);
  if (assets?.pageId) updates.META_PAGE_ID = assets.pageId;
  if (assets?.adAccountId) updates.META_AD_ACCOUNT_ID = assets.adAccountId;
  if (assets?.instagramBusinessAccountId) {
    updates.INSTAGRAM_BUSINESS_ACCOUNT_ID = assets.instagramBusinessAccountId;
  }
  if (assets?.whatsappPhoneNumberId) {
    updates.WHATSAPP_PHONE_NUMBER_ID = assets.whatsappPhoneNumberId;
  }
  if (assets?.whatsappBusinessAccountId) {
    updates.WHATSAPP_BUSINESS_ACCOUNT_ID = assets.whatsappBusinessAccountId;
  }

  // Garante integração omnichannel ativa
  updates.CHATWOOT_ENABLED = "true";

  if (!Object.keys(updates).length) {
    console.log("Nada para sincronizar (sem .meta-token.local.json / .meta-assets.local.json).");
    return;
  }

  const keys = upsertEnv(updates);
  console.log("Atualizado .env:", keys.join(", "));
}

main();
