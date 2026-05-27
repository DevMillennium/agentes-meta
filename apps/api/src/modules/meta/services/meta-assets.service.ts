import { env, getMetaAccessToken } from "../../../config/env";
import { loadMetaAssets, saveMetaAssets, type MetaAssetsConfig } from "../../../config/meta-assets.store";
import { getMetaGraphJson } from "./meta-graph.client";

interface GraphList<T> {
  data?: T[];
}

export async function syncMetaAssetsFromGraph(): Promise<MetaAssetsConfig> {
  const token = getMetaAccessToken();
  if (!token) {
    throw new Error("META_ACCESS_TOKEN ausente. Conecte via OAuth primeiro.");
  }

  const base = `https://graph.facebook.com/${env.META_API_VERSION}`;
  const current = loadMetaAssets();
  const result: MetaAssetsConfig = { ...current };

  const adAccounts = await getMetaGraphJson<GraphList<{ id: string; name?: string }>>(
    `${base}/me/adaccounts`,
    { fields: "id,name,account_status", limit: 10 }
  );
  const firstAccount = adAccounts.data?.find((a) => a.id) ?? adAccounts.data?.[0];
  if (firstAccount?.id) {
    result.adAccountId = firstAccount.id.startsWith("act_")
      ? firstAccount.id
      : `act_${firstAccount.id}`;
  }

  const pages = await getMetaGraphJson<GraphList<{ id: string; name?: string }>>(
    `${base}/me/accounts`,
    { fields: "id,name,instagram_business_account", limit: 10 }
  );
  const page = pages.data?.[0];
  if (page?.id) {
    result.pageId = page.id;
    const ig = (page as { instagram_business_account?: { id: string } }).instagram_business_account;
    if (ig?.id) {
      result.instagramBusinessAccountId = ig.id;
    }
  }

  if (!result.instagramBusinessAccountId && result.pageId) {
    try {
      const pageDetail = await getMetaGraphJson<{
        instagram_business_account?: { id: string };
      }>(`${base}/${result.pageId}`, { fields: "instagram_business_account" });
      if (pageDetail.instagram_business_account?.id) {
        result.instagramBusinessAccountId = pageDetail.instagram_business_account.id;
      }
    } catch {
      // página sem IG vinculado
    }
  }

  try {
    const waba = await getMetaGraphJson<GraphList<{ id: string }>>(
      `${base}/me/businesses`,
      { fields: "id", limit: 1 }
    );
    const businessId = waba.data?.[0]?.id;
    if (businessId) {
      result.whatsappBusinessAccountId = businessId;
      const phones = await getMetaGraphJson<GraphList<{ id: string; display_phone_number?: string }>>(
        `${base}/${businessId}/phone_numbers`,
        { fields: "id,display_phone_number", limit: 5 }
      );
      if (phones.data?.[0]?.id) {
        result.whatsappPhoneNumberId = phones.data[0].id;
      }
    }
  } catch {
    // WABA pode exigir permissões extras
  }

  saveMetaAssets(result);
  return result;
}
