import fs from "node:fs";
import path from "node:path";

export interface MetaAssetsConfig {
  adAccountId?: string;
  pageId?: string;
  instagramBusinessAccountId?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  syncedAt?: string;
}

const assetsFilePath = path.resolve(__dirname, "../../../..", ".meta-assets.local.json");

export function loadMetaAssets(): MetaAssetsConfig {
  try {
    if (!fs.existsSync(assetsFilePath)) return {};
    return JSON.parse(fs.readFileSync(assetsFilePath, "utf8")) as MetaAssetsConfig;
  } catch {
    return {};
  }
}

export function saveMetaAssets(assets: MetaAssetsConfig): void {
  fs.writeFileSync(
    assetsFilePath,
    JSON.stringify({ ...assets, syncedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export function getMetaAssetsFilePath(): string {
  return assetsFilePath;
}

/** Resolve ID: .env > assets (contexto ou arquivo local) */
export function resolveMetaAsset(
  envValue: string | undefined,
  key: keyof MetaAssetsConfig,
  assets: MetaAssetsConfig = loadMetaAssets()
): string | undefined {
  const fromEnv = envValue?.trim();
  if (fromEnv) return fromEnv;
  const stored = assets[key];
  return typeof stored === "string" && stored.trim() ? stored.trim() : undefined;
}
