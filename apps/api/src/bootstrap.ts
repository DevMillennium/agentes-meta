import { bootstrapUsers } from "./modules/auth/users.bootstrap";

let started = false;

export async function ensureBootstrap(): Promise<void> {
  if (started) return;
  await bootstrapUsers();
  started = true;
}
