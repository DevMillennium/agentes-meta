import type { Request, Response } from "express";
import { createApp } from "../apps/api/src/app";
import { ensureBootstrap } from "../apps/api/src/bootstrap";

const app = createApp();
let bootstrapStarted = false;
let initError: string | null = null;

function startBootstrapOnce(): void {
  if (bootstrapStarted) return;
  bootstrapStarted = true;
  void ensureBootstrap().catch((error: unknown) => {
    initError = error instanceof Error ? error.message : "Falha no bootstrap.";
    console.error("[phoenix-api] bootstrap background error:", error);
  });
}

async function getHandler(): Promise<(req: Request, res: Response) => unknown> {
  if (initError) throw new Error(initError);
  startBootstrapOnce();
  return app;
}

export default async function vercelHandler(req: Request, res: Response) {
  try {
    const fn = await getHandler();
    return fn(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    console.error("[phoenix-api] init/runtime error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "FUNCTION_INVOCATION_FAILED",
        message,
        hint: "Verifique DATABASE_URL, prisma db push e variáveis em Vercel → Environment Variables."
      });
    }
  }
}
