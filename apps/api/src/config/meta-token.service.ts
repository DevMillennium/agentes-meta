import { prisma } from "../common/prisma";
import { getRequestUserId } from "../common/request-context";
import {
  loadStoredMetaToken,
  saveStoredMetaToken,
  clearStoredMetaToken,
  type StoredMetaToken
} from "./meta-token.store";

export type { StoredMetaToken };

function isDbUserId(userId: string | undefined): boolean {
  return Boolean(userId && userId !== "api-key-admin");
}

export async function loadUserMetaToken(userId: string): Promise<StoredMetaToken | null> {
  if (!isDbUserId(userId)) {
    return loadStoredMetaToken();
  }

  const row = await prisma.userMetaConnection.findUnique({ where: { userId } });
  if (!row?.accessToken?.trim()) return null;

  return {
    accessToken: row.accessToken,
    tokenType: row.tokenType ?? undefined,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    obtainedAt: row.obtainedAt.toISOString(),
    scopes: row.scopes ?? undefined
  };
}

export async function saveUserMetaToken(userId: string, token: StoredMetaToken): Promise<void> {
  if (!isDbUserId(userId)) {
    saveStoredMetaToken(token);
    return;
  }

  await prisma.userMetaConnection.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: token.accessToken,
      tokenType: token.tokenType ?? "user",
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
      obtainedAt: new Date(token.obtainedAt),
      scopes: token.scopes ?? null
    },
    update: {
      accessToken: token.accessToken,
      tokenType: token.tokenType ?? "user",
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
      obtainedAt: new Date(token.obtainedAt),
      scopes: token.scopes ?? null
    }
  });
}

export async function clearUserMetaToken(userId: string): Promise<void> {
  if (!isDbUserId(userId)) {
    clearStoredMetaToken();
    return;
  }
  await prisma.userMetaConnection.deleteMany({ where: { userId } });
}

export async function getMetaAccessTokenAsync(userId?: string): Promise<string | undefined> {
  const resolvedUserId = userId ?? getRequestUserId();
  if (resolvedUserId && isDbUserId(resolvedUserId)) {
    const stored = await loadUserMetaToken(resolvedUserId);
    if (stored?.accessToken?.trim()) return stored.accessToken.trim();
  }

  const fromFile = loadStoredMetaToken()?.accessToken?.trim();
  if (fromFile) return fromFile;

  const fromEnv = process.env.META_ACCESS_TOKEN?.trim();
  return fromEnv || undefined;
}
