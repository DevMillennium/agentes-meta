import serverless from "serverless-http";
import type { Request, Response } from "express";

let handler: ReturnType<typeof serverless> | null = null;
let initError: string | null = null;

async function getHandler(): Promise<ReturnType<typeof serverless>> {
  if (initError) {
    throw new Error(initError);
  }
  if (handler) return handler;

  try {
    const { ensureBootstrap } = await import("../src/bootstrap");
    const { createApp } = await import("../src/app");
    await ensureBootstrap();
    handler = serverless(createApp());
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
        hint: "Verifique DATABASE_URL e variáveis em Vercel → Environment Variables."
      });
    }
  }
}
