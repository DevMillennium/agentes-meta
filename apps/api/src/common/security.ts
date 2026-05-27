import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { loadUserMetaAssets } from "../config/meta-assets.service";
import { getMetaAccessTokenAsync } from "../config/meta-token.service";
import { runWithUserContext } from "./request-context";
import { authenticateUser } from "../modules/auth/users.service";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: "admin" | "operator" | "viewer";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

function readBearerToken(req: Request): string | null {
  const authorization = req.header("authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function signAccessToken(user: AuthenticatedUser): string {
  return jwt.sign(user, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    subject: user.userId
  });
}

async function attachUserContext(req: AuthenticatedRequest, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;
  if (!userId || userId === "api-key-admin") {
    next();
    return;
  }

  const [metaAccessToken, metaAssets] = await Promise.all([
    getMetaAccessTokenAsync(userId),
    loadUserMetaAssets(userId)
  ]);
  runWithUserContext(userId, { metaAccessToken, metaAssets }, () => next());
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const apiKey = req.header("x-api-key");
  if (apiKey && apiKey === env.ADMIN_API_KEY) {
    req.user = {
      userId: "api-key-admin",
      email: env.ADMIN_EMAIL,
      role: "admin"
    };
    void attachUserContext(req, next);
    return;
  }

  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Token de acesso ausente." });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    req.user = {
      userId: String(decoded.sub ?? decoded.userId ?? "unknown"),
      email: String(decoded.email ?? ""),
      role: String(decoded.role ?? "viewer") as AuthenticatedUser["role"]
    };
    void attachUserContext(req, next);
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

export function requireRole(roles: AuthenticatedUser["role"][]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Acesso negado para este perfil." });
      return;
    }

    next();
  };
}

export function requireOperatorAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => requireRole(["admin", "operator"])(req, res, next));
}

export function requireAdminAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => requireRole(["admin"])(req, res, next));
}

export async function authenticateAdminLogin(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  return authenticateUser(email, password);
}

export function requireAdminApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header("x-api-key");
  if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
    res.status(401).json({ error: "Não autorizado por API key." });
    return;
  }

  next();
}

export function verifyMetaSignature(rawBody: string, signatureHeader?: string): boolean {
  if (!env.META_APP_SECRET || !signatureHeader) return false;
  const [algorithm, receivedSignature] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !receivedSignature) return false;

  const expectedSignature = createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}
