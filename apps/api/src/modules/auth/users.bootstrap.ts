import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../common/prisma";
import { env } from "../../config/env";
import { logger } from "../../common/logger";

const bootstrapUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["admin", "operator", "viewer"]).default("operator")
});

let bootstrapDone = false;

export async function bootstrapUsers(): Promise<void> {
  if (bootstrapDone) return;

  const raw = process.env.USERS_BOOTSTRAP?.trim();
  if (raw) {
    try {
      const parsed = z.array(bootstrapUserSchema).parse(JSON.parse(raw));
      for (const user of parsed) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        await prisma.user.upsert({
          where: { email: user.email.toLowerCase() },
          create: {
            email: user.email.toLowerCase(),
            name: user.name,
            role: user.role,
            passwordHash
          },
          update: {
            name: user.name,
            role: user.role,
            passwordHash
          }
        });
      }
      logger.info({ count: parsed.length }, "Usuários bootstrap sincronizados (USERS_BOOTSTRAP).");
    } catch (error) {
      logger.error({ error }, "USERS_BOOTSTRAP inválido — ignorando.");
    }
  }

  const adminEmail = env.ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Administrador",
      role: "admin",
      passwordHash
    },
    update: { passwordHash }
  });
  logger.info({ email: admin.email }, "Usuário admin sincronizado com ADMIN_PASSWORD do ambiente.");

  bootstrapDone = true;
}
