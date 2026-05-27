import { env } from "../config/env";

export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL?.trim());
}

export function getRedisConnectionOptions(): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
} {
  if (!isRedisConfigured()) {
    throw new Error("REDIS_URL não configurada.");
  }
  const redisUrl = new URL(env.REDIS_URL);
  const dbFromPath = redisUrl.pathname.replace("/", "");
  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: dbFromPath ? Number(dbFromPath) : undefined
  };
}

export function getRedisConnectionDescription(): string {
  const redisUrl = new URL(env.REDIS_URL);
  const dbFromPath = redisUrl.pathname.replace("/", "");
  const dbText = dbFromPath ? `/${dbFromPath}` : "";
  return `${redisUrl.hostname}:${redisUrl.port || "6379"}${dbText}`;
}
