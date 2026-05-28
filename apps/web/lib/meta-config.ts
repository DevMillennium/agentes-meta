import { META_OAUTH_SCOPES } from "./meta-oauth-scopes";

export const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
export const META_API_VERSION = process.env.NEXT_PUBLIC_META_API_VERSION ?? "v25.0";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Escopos alinhados ao OAuth do backend Phoenix (fonte: @phoenix/shared). */
export const META_LOGIN_SCOPES = META_OAUTH_SCOPES;
