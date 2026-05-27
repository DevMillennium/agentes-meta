import fs from "node:fs";
import path from "node:path";

export interface StoredMetaToken {
  accessToken: string;
  tokenType?: string;
  expiresAt?: string | null;
  obtainedAt: string;
  scopes?: string;
}

const tokenFilePath = path.resolve(__dirname, "../../../..", ".meta-token.local.json");

export function loadStoredMetaToken(): StoredMetaToken | null {
  try {
    if (!fs.existsSync(tokenFilePath)) return null;
    const raw = fs.readFileSync(tokenFilePath, "utf8");
    const parsed = JSON.parse(raw) as StoredMetaToken;
    if (!parsed.accessToken?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredMetaToken(token: StoredMetaToken): void {
  fs.writeFileSync(tokenFilePath, JSON.stringify(token, null, 2), "utf8");
}

export function clearStoredMetaToken(): void {
  if (fs.existsSync(tokenFilePath)) {
    fs.unlinkSync(tokenFilePath);
  }
}

export function getMetaTokenFilePath(): string {
  return tokenFilePath;
}
