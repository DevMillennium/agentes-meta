import { logger } from "./common/logger";
import { bootstrapUsers } from "./modules/auth/users.bootstrap";

let started = false;
let bootstrapError: string | null = null;

export function getBootstrapError(): string | null {
  return bootstrapError;
}

export async function ensureBootstrap(): Promise<void> {
  if (started || bootstrapError) return;
  try {
    await bootstrapUsers();
    started = true;
  } catch (error) {
    bootstrapError = error instanceof Error ? error.message : "Bootstrap falhou.";
    logger.error({ error }, "Bootstrap da API falhou (verifique DATABASE_URL).");
  }
}
