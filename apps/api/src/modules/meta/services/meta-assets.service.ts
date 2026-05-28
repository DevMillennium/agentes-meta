import { env, getMetaAccessToken } from "../../../config/env";
import {
  loadUserMetaAssets,
  saveUserMetaAssets
} from "../../../config/meta-assets.service";
import type { MetaAssetsConfig } from "../../../config/meta-assets.store";
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
  const current = await loadUserMetaAssets();
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
    const businesses = await getMetaGraphJson<GraphList<{ id: string }>>(`${base}/me/businesses`, {
      fields: "id",
      limit: 5
    });
    for (const business of businesses.data ?? []) {
      const businessId = business.id;
      if (!businessId) continue;
      try {
        const wabas = await getMetaGraphJson<GraphList<{ id: string }>>(
          `${base}/${businessId}/owned_whatsapp_business_accounts`,
          { fields: "id,name", limit: 5 }
        );
        const wabaId = wabas.data?.[0]?.id;
        if (!wabaId) continue;
        result.whatsappBusinessAccountId = wabaId;
        const phones = await getMetaGraphJson<GraphList<{ id: string; display_phone_number?: string }>>(
          `${base}/${wabaId}/phone_numbers`,
          { fields: "id,display_phone_number", limit: 5 }
        );
        if (phones.data?.[0]?.id) {
          result.whatsappPhoneNumberId = phones.data[0].id;
        }
        break;
      } catch {
        // pode não ter permissão para esse business específico
      }
    }
  } catch {
    // WABA pode exigir permissões extras
  }

  await saveUserMetaAssets(result);
  return result;
}
