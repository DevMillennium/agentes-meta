import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function requireAdminApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header("x-api-key");

  if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
    res.status(401).json({ error: "Não autorizado." });
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
