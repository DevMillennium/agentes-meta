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

export interface MetaInstagramAccount {
  id: string;
  username?: string;
  name?: string;
  followersCount?: number;
  profilePictureUrl?: string;
  linkedPageId?: string;
  linkedPageName?: string;
}

export interface MetaPageAsset {
  id: string;
  name?: string;
  category?: string;
  instagramBusinessAccountId?: string;
}

export interface MetaAdAccountAsset {
  id: string;
  name?: string;
  accountStatus?: number;
  currency?: string;
}

export interface MetaBusinessAsset {
  id: string;
  name?: string;
  verificationStatus?: string;
}

export interface MetaWhatsAppAsset {
  wabaId: string;
  name?: string;
  phoneNumbers: { id: string; displayPhoneNumber?: string; verifiedName?: string }[];
}

export interface MetaDiscoveredAssets {
  me: { id?: string; name?: string };
  businesses: MetaBusinessAsset[];
  adAccounts: MetaAdAccountAsset[];
  pages: MetaPageAsset[];
  instagramAccounts: MetaInstagramAccount[];
  whatsappAccounts: MetaWhatsAppAsset[];
  errors: Record<string, string>;
}

interface GraphPage {
  id: string;
  name?: string;
  category?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
    followers_count?: number;
    profile_picture_url?: string;
  };
}

/**
 * Descobre e LISTA todos os ativos Meta conectados ao token do usuário:
 * contas business, ad accounts, páginas, Instagram business e WhatsApp.
 * Cada bloco é resiliente: falha de permissão em um não derruba os demais.
 */
export async function discoverMetaAssets(): Promise<MetaDiscoveredAssets> {
  const token = getMetaAccessToken();
  if (!token) {
    throw new Error("META_ACCESS_TOKEN ausente. Conecte via OAuth primeiro.");
  }

  const base = `https://graph.facebook.com/${env.META_API_VERSION}`;
  const errors: Record<string, string> = {};
  const result: MetaDiscoveredAssets = {
    me: {},
    businesses: [],
    adAccounts: [],
    pages: [],
    instagramAccounts: [],
    whatsappAccounts: [],
    errors
  };

  const describe = (error: unknown): string =>
    error instanceof Error ? error.message : "Erro desconhecido";

  try {
    result.me = await getMetaGraphJson<{ id?: string; name?: string }>(`${base}/me`, {
      fields: "id,name"
    });
  } catch (error) {
    errors.me = describe(error);
  }

  try {
    const businesses = await getMetaGraphJson<
      GraphList<{ id: string; name?: string; verification_status?: string }>
    >(`${base}/me/businesses`, { fields: "id,name,verification_status", limit: 25 });
    result.businesses = (businesses.data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      verificationStatus: b.verification_status
    }));
  } catch (error) {
    errors.businesses = describe(error);
  }

  try {
    const adAccounts = await getMetaGraphJson<
      GraphList<{ id: string; name?: string; account_status?: number; currency?: string }>
    >(`${base}/me/adaccounts`, { fields: "id,name,account_status,currency", limit: 50 });
    result.adAccounts = (adAccounts.data ?? []).map((a) => ({
      id: a.id.startsWith("act_") ? a.id : `act_${a.id}`,
      name: a.name,
      accountStatus: a.account_status,
      currency: a.currency
    }));
  } catch (error) {
    errors.adAccounts = describe(error);
  }

  try {
    const pages = await getMetaGraphJson<GraphList<GraphPage>>(`${base}/me/accounts`, {
      fields:
        "id,name,category,instagram_business_account{id,username,name,followers_count,profile_picture_url}",
      limit: 50
    });
    for (const page of pages.data ?? []) {
      result.pages.push({
        id: page.id,
        name: page.name,
        category: page.category,
        instagramBusinessAccountId: page.instagram_business_account?.id
      });
      const ig = page.instagram_business_account;
      if (ig?.id) {
        result.instagramAccounts.push({
          id: ig.id,
          username: ig.username,
          name: ig.name,
          followersCount: ig.followers_count,
          profilePictureUrl: ig.profile_picture_url,
          linkedPageId: page.id,
          linkedPageName: page.name
        });
      }
    }
  } catch (error) {
    errors.pages = describe(error);
  }

  for (const business of result.businesses) {
    try {
      const wabas = await getMetaGraphJson<GraphList<{ id: string; name?: string }>>(
        `${base}/${business.id}/owned_whatsapp_business_accounts`,
        { fields: "id,name", limit: 25 }
      );
      for (const waba of wabas.data ?? []) {
        if (!waba.id) continue;
        let phoneNumbers: MetaWhatsAppAsset["phoneNumbers"] = [];
        try {
          const phones = await getMetaGraphJson<
            GraphList<{ id: string; display_phone_number?: string; verified_name?: string }>
          >(`${base}/${waba.id}/phone_numbers`, {
            fields: "id,display_phone_number,verified_name",
            limit: 25
          });
          phoneNumbers = (phones.data ?? []).map((p) => ({
            id: p.id,
            displayPhoneNumber: p.display_phone_number,
            verifiedName: p.verified_name
          }));
        } catch {
          // sem permissão para listar números desta WABA
        }
        result.whatsappAccounts.push({ wabaId: waba.id, name: waba.name, phoneNumbers });
      }
    } catch (error) {
      errors[`waba:${business.id}`] = describe(error);
    }
  }

  return result;
}
