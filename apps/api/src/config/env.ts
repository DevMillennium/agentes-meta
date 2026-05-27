import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  META_API_VERSION: z.string().default("v21.0"),
  META_ACCESS_TOKEN: z.string().optional()
});

export const env = envSchema.parse(process.env);
