import { logger } from "./common/logger";
import { bootstrapUsers } from "./modules/auth/users.bootstrap";

let started = false;
let bootstrapError: string | null = null;
let inFlight: Promise<void> | null = null;

export function getBootstrapError(): string | null {
  return bootstrapError;
}

export function isBootstrapped(): boolean {
  return started;
}

/**
 * Idempotente e re-tentável. Em serverless + Postgres com autosuspend (Neon),
 * o primeiro acesso pode falhar por cold-start; nesse caso NÃO travamos o erro:
 * a próxima request tenta de novo e o sistema se auto-recupera quando o banco acorda.
 */
export async function ensureBootstrap(): Promise<void> {
  if (started) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      await bootstrapUsers();
      started = true;
      bootstrapError = null;
    } catch (error) {
      bootstrapError = error instanceof Error ? error.message : "Bootstrap falhou.";
      logger.error({ error }, "Bootstrap da API falhou (retry na próxima request).");
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
