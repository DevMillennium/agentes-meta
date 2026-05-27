import { randomBytes } from "node:crypto";
import { env, getMetaRedirectUri, isMetaOAuthConfigured } from "../../../config/env";
import { saveStoredMetaToken, type StoredMetaToken } from "../../../config/meta-token.store";
import { getMetaGraphPublicJson, MetaGraphRequestError } from "./meta-graph.client";

const OAUTH_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "pages_manage_posts",
  "instagram_content_publish"
].join(",");

const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates(): void {
  const now = Date.now();
  for (const [state, expires] of pendingStates) {
    if (expires < now) pendingStates.delete(state);
  }
}

export function createOAuthState(): string {
  pruneStates();
  const state = randomBytes(24).toString("hex");
  pendingStates.set(state, Date.now() + STATE_TTL_MS);
  return state;
}

export function validateOAuthState(state: string | undefined): boolean {
  if (!state) return false;
  const expires = pendingStates.get(state);
  if (!expires) return false;
  pendingStates.delete(state);
  return expires >= Date.now();
}

export function buildOAuthLoginUrl(state: string): string {
  if (!isMetaOAuthConfigured()) {
    throw new Error("META_APP_ID e META_APP_SECRET são obrigatórios para OAuth.");
  }
  const redirectUri = encodeURIComponent(getMetaRedirectUri());
  const scope = encodeURIComponent(OAUTH_SCOPES);
  return (
    `https://www.facebook.com/${env.META_API_VERSION}/dialog/oauth` +
    `?client_id=${encodeURIComponent(env.META_APP_ID)}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${scope}` +
    `&response_type=code`
  );
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export function getOAuthScopes(): string {
  return OAUTH_SCOPES;
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<TokenResponse> {
  const base = `https://graph.facebook.com/${env.META_API_VERSION}/oauth/access_token`;
  try {
    return await getMetaGraphPublicJson<TokenResponse>(base, {
      grant_type: "fb_exchange_token",
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET ?? "",
      fb_exchange_token: shortLivedToken
    });
  } catch {
    return { access_token: shortLivedToken };
  }
}

function buildStoredToken(longLived: TokenResponse, shortLived?: TokenResponse): StoredMetaToken {
  const accessToken = longLived.access_token;
  if (!accessToken) {
    throw new MetaGraphRequestError("Não foi possível obter access_token.");
  }

  const expiresIn = longLived.expires_in ?? shortLived?.expires_in;
  return {
    accessToken,
    tokenType: longLived.token_type ?? "user",
    expiresAt:
      typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    obtainedAt: new Date().toISOString(),
    scopes: OAUTH_SCOPES
  };
}

/** Troca token curto do JS SDK por long-lived e persiste no servidor. */
export async function exchangeShortLivedAccessToken(shortLivedToken: string): Promise<StoredMetaToken> {
  if (!isMetaOAuthConfigured()) {
    throw new Error("META_APP_ID e META_APP_SECRET são obrigatórios.");
  }

  const debug = await debugToken(shortLivedToken);
  const isValid = (debug as { data?: { is_valid?: boolean } }).data?.is_valid;
  if (isValid === false) {
    throw new MetaGraphRequestError("Token do Facebook inválido.");
  }

  const longLived = await exchangeForLongLivedToken(shortLivedToken);
  const stored = buildStoredToken(longLived);
  saveStoredMetaToken(stored);
  return stored;
}

export async function exchangeCodeForAccessToken(code: string): Promise<StoredMetaToken> {
  if (!isMetaOAuthConfigured()) {
    throw new Error("META_APP_ID e META_APP_SECRET são obrigatórios.");
  }

  const redirectUri = getMetaRedirectUri();
  const base = `https://graph.facebook.com/${env.META_API_VERSION}/oauth/access_token`;

  let shortLived: TokenResponse;
  try {
    shortLived = await getMetaGraphPublicJson<TokenResponse>(base, {
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET ?? "",
      redirect_uri: redirectUri,
      code
    });
  } catch (error) {
    if (error instanceof MetaGraphRequestError) {
      throw error;
    }
    throw error;
  }

  if (!shortLived.access_token) {
    throw new MetaGraphRequestError("OAuth não retornou access_token.");
  }

  const longLived = await exchangeForLongLivedToken(shortLived.access_token);
  const stored = buildStoredToken(longLived, shortLived);
  saveStoredMetaToken(stored);
  return stored;
}

export async function debugToken(accessToken: string): Promise<Record<string, unknown>> {
  return getMetaGraphPublicJson<Record<string, unknown>>(
    `https://graph.facebook.com/${env.META_API_VERSION}/debug_token`,
    {
      input_token: accessToken,
      access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}`
    }
  );
}
