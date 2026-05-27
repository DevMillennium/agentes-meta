import type { MetaAssetsConfig } from "./meta-assets.store";
import { loadMetaAssets, saveMetaAssets } from "./meta-assets.store";
import { getRequestUserId } from "../common/request-context";
import type { Prisma } from "@prisma/client";
import { prisma } from "../common/prisma";

function isDbUserId(userId: string | undefined): boolean {
  return Boolean(userId && userId !== "api-key-admin");
}

export async function loadUserMetaAssets(userId?: string): Promise<MetaAssetsConfig> {
  const resolvedUserId = userId ?? getRequestUserId();
  if (resolvedUserId && isDbUserId(resolvedUserId)) {
    const row = await prisma.userMetaConnection.findUnique({ where: { userId: resolvedUserId } });
    if (row?.assetsJson && typeof row.assetsJson === "object") {
      return row.assetsJson as MetaAssetsConfig;
    }
    return {};
  }
  return loadMetaAssets();
}

export async function saveUserMetaAssets(
  assets: MetaAssetsConfig,
  userId?: string
): Promise<void> {
  const synced: MetaAssetsConfig = { ...assets, syncedAt: new Date().toISOString() };
  const resolvedUserId = userId ?? getRequestUserId();

  if (resolvedUserId && isDbUserId(resolvedUserId)) {
    await prisma.userMetaConnection.updateMany({
      where: { userId: resolvedUserId },
      data: {
        assetsJson: synced as Prisma.InputJsonValue,
        assetsSyncedAt: new Date()
      }
    });
    return;
  }

  saveMetaAssets(synced);
}
