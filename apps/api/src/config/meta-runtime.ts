import { env } from "./env";
import { loadMetaAssets, resolveMetaAsset } from "./meta-assets.store";

export function getEffectiveMetaIds() {
  const assets = loadMetaAssets();
  return {
    adAccountId: resolveMetaAsset(env.META_AD_ACCOUNT_ID, "adAccountId"),
    pageId: resolveMetaAsset(env.META_PAGE_ID, "pageId"),
    instagramBusinessAccountId: resolveMetaAsset(
      env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      "instagramBusinessAccountId"
    ),
    whatsappPhoneNumberId: resolveMetaAsset(
      env.WHATSAPP_PHONE_NUMBER_ID,
      "whatsappPhoneNumberId"
    ),
    whatsappBusinessAccountId: resolveMetaAsset(
      env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      "whatsappBusinessAccountId"
    ),
    assetsSyncedAt: assets.syncedAt ?? null
  };
}
