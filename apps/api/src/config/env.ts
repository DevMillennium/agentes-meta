import { config as loadEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";
import { loadStoredMetaToken } from "./meta-token.store";

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
  REDIS_URL: z.string().min(1),
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
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY é obrigatória para agentes."),
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
  const fromEnv = process.env.META_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return loadStoredMetaToken()?.accessToken?.trim() || env.META_ACCESS_TOKEN?.trim() || undefined;
}

export function getMetaRedirectUri(): string {
  const explicit = env.META_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `http://localhost:${env.PORT}/api/meta/oauth/callback`;
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(env.META_APP_ID?.trim() && env.META_APP_SECRET?.trim());
}
