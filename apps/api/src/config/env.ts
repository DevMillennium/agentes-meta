import { config as loadEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";

loadEnv({ path: path.resolve(__dirname, "../../../..", ".env") });
loadEnv();

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
  META_API_VERSION: z.string().default("v21.0"),
  META_ACCESS_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(8, "META_WEBHOOK_VERIFY_TOKEN é obrigatória."),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional().default(""),
  META_HTTP_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(15000),
  META_HTTP_RETRIES: z.coerce.number().min(0).max(5).default(2)
});

export const env = envSchema.parse(process.env);
