import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ADMIN_API_KEY: z.string().min(16, "ADMIN_API_KEY deve ter pelo menos 16 caracteres."),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY é obrigatória para agentes."),
  META_API_VERSION: z.string().default("v21.0"),
  META_ACCESS_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(8, "META_WEBHOOK_VERIFY_TOKEN é obrigatória.")
});

export const env = envSchema.parse(process.env);
