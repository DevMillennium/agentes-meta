/**
 * Exporta access_token Meta (arquivo local ou Postgres) para stdout.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, ".env") });

const TOKEN_FILE = path.join(repoRoot, ".meta-token.local.json");

async function main(): Promise<void> {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const raw = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as { accessToken?: string };
      if (raw.accessToken?.trim()) {
        process.stdout.write(raw.accessToken.trim());
        return;
      }
    }
  } catch {
    /* fallthrough */
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const row = await prisma.userMetaConnection.findFirst({
      where: { accessToken: { not: "" } },
      orderBy: { obtainedAt: "desc" }
    });
    if (row?.accessToken?.trim()) {
      process.stdout.write(row.accessToken.trim());
      return;
    }
  } finally {
    await prisma.$disconnect();
  }

  process.exit(2);
}

main().catch(() => process.exit(1));
