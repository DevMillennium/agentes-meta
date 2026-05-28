import type { Request, Response } from "express";
import { createApp } from "../apps/api/src/app";
import { ensureBootstrap } from "../apps/api/src/bootstrap";

const app = createApp();

export default async function vercelHandler(req: Request, res: Response) {
  try {
    // Fire-and-forget e idempotente: tenta inicializar a cada request até ter
    // sucesso (resiliente a cold-start do Neon). Não bloqueia o tratamento da request.
    void ensureBootstrap();
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    console.error("[phoenix-api] runtime error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "FUNCTION_INVOCATION_FAILED",
        message,
        hint: "Verifique DATABASE_URL, prisma db push e variáveis em Vercel → Environment Variables."
      });
    }
  }
}
