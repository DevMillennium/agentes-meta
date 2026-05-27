import { config as loadEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";
import { loadStoredMetaToken } from "./meta-token.store";
import { getRequestUserId, requestContext } from "../common/request-context";

const repoRoot = path.resolve(__dirname, "../../../..");
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv();

const storedToken = loadStoredMetaToken();
const resolvedMetaAccessToken =
  process.env.META_ACCESS_TOKEN?.trim() || storedToken?.accessToken?.trim() || undefined;

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().default(""),
  API_PUBLIC_URL: z.string().url().optional().or(z.literal("")).default(""),
  WEB_APP_URL: z.string().url().optional().or(z.literal("")).default(""),
  API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ADMIN_API_KEY: z.string().min(16, "ADMIN_API_KEY deve ter pelo menos 16 caracteres."),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL inválido."),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD deve ter pelo menos 8 caracteres."),
  JWT_SECRET: z.string().min(16, "JWT_SECRET deve ter pelo menos 16 caracteres."),
  JWT_EXPIRES_IN: z.string().default("12h"),
  ENABLE_WORKERS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OPENAI_API_KEY: z.string().optional().default(""),
  META_APP_ID: z.string().optional().default(""),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional().default(""),
  META_API_VERSION: z.string().default("v25.0"),
  META_ACCESS_TOKEN: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional().default(""),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(8, "META_WEBHOOK_VERIFY_TOKEN é obrigatória."),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(""),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional().default(""),
  META_PAGE_ID: z.string().optional().default(""),
  META_HTTP_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(15000),
  META_HTTP_RETRIES: z.coerce.number().min(0).max(5).default(2)
});

const parsed = envSchema.parse({
  ...process.env,
  META_ACCESS_TOKEN: resolvedMetaAccessToken
});

export const env = {
  ...parsed,
  metaTokenFromFile: Boolean(storedToken?.accessToken && !process.env.META_ACCESS_TOKEN?.trim())
};

export function getMetaAccessToken(): string | undefined {
  const fromContext = requestContext.getStore()?.metaAccessToken?.trim();
  if (fromContext) return fromContext;

  const fromEnv = process.env.META_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return loadStoredMetaToken()?.accessToken?.trim() || env.META_ACCESS_TOKEN?.trim() || undefined;
}

export function getApiPublicUrl(): string {
  const explicit = env.API_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return `http://localhost:${env.PORT}`;
}

export function getWebAppUrl(): string {
  const explicit = env.WEB_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return env.API_CORS_ORIGIN.replace(/\/$/, "");
}

export function getMetaRedirectUri(): string {
  const explicit = env.META_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getApiPublicUrl()}/api/meta/oauth/callback`;
}

export function getCorsOrigins(): string[] {
  const origins = new Set<string>();
  for (const part of env.API_CORS_ORIGIN.split(",")) {
    const trimmed = part.trim();
    if (trimmed) origins.add(trimmed);
  }
  const web = getWebAppUrl();
  if (web) origins.add(web);
  origins.add(`http://localhost:${env.PORT}`);
  origins.add("http://127.0.0.1:3000");
  origins.add("http://localhost:3000");
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }
  return [...origins];
}

/** @deprecated use getRequestUserId — mantido para compatibilidade */
export function getCurrentMetaUserId(): string | undefined {
  return getRequestUserId();
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(env.META_APP_ID?.trim() && env.META_APP_SECRET?.trim());
}
