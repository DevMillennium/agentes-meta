import serverless from "serverless-http";
import type { Request, Response } from "express";
import { createApp } from "../apps/api/src/app";
import { ensureBootstrap } from "../apps/api/src/bootstrap";

let handler: ReturnType<typeof serverless> | null = null;
let initError: string | null = null;

async function getHandler(): Promise<ReturnType<typeof serverless>> {
  if (initError) throw new Error(initError);
  if (handler) return handler;

  try {
    handler = serverless(createApp());
    // Não bloquear cold start em operações de banco; bootstrap roda em segundo plano.
    void ensureBootstrap().catch((error: unknown) => {
      initError = error instanceof Error ? error.message : "Falha no bootstrap.";
      console.error("[phoenix-api] bootstrap background error:", error);
    });
    return handler;
  } catch (error) {
    initError = error instanceof Error ? error.message : "Falha ao iniciar API.";
    throw error;
  }
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
