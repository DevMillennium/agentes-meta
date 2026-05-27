import bcrypt from "bcryptjs";
import { prisma } from "../../common/prisma";
import type { AuthenticatedUser } from "../../common/security";

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    userId: user.id,
    email: user.email,
    role: user.role as AuthenticatedUser["role"]
  };
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role: AuthenticatedUser["role"];
}): Promise<AuthenticatedUser> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      passwordHash
    }
  });
  return {
    userId: user.id,
    email: user.email,
    role: user.role as AuthenticatedUser["role"]
  };
}

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      metaConnection: {
        select: {
          obtainedAt: true,
          expiresAt: true,
          assetsSyncedAt: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });
}
