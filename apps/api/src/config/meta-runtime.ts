import { env } from "./env";
import { loadMetaAssets, resolveMetaAsset, type MetaAssetsConfig } from "./meta-assets.store";
import { getRequestMetaAssets } from "../common/request-context";

function getAssetsSource(): MetaAssetsConfig {
  return getRequestMetaAssets() ?? loadMetaAssets();
}

export function getEffectiveMetaIds() {
  const assets = getAssetsSource();
  return {
    adAccountId: resolveMetaAsset(env.META_AD_ACCOUNT_ID, "adAccountId", assets),
    pageId: resolveMetaAsset(env.META_PAGE_ID, "pageId", assets),
    instagramBusinessAccountId: resolveMetaAsset(
      env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      "instagramBusinessAccountId",
      assets
    ),
    whatsappPhoneNumberId: resolveMetaAsset(
      env.WHATSAPP_PHONE_NUMBER_ID,
      "whatsappPhoneNumberId",
      assets
    ),
    whatsappBusinessAccountId: resolveMetaAsset(
      env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      "whatsappBusinessAccountId",
      assets
    ),
    assetsSyncedAt: assets.syncedAt ?? null
  };
}
