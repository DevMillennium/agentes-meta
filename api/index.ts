import serverless from "serverless-http";
import type { Request, Response } from "express";

// phoenix-dist é gerado em install (vercel.json) — require evita erro TS antes do build
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createApp } = require("./phoenix-dist/app") as {
  createApp: () => import("express").Express;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ensureBootstrap } = require("./phoenix-dist/bootstrap") as {
  ensureBootstrap: () => Promise<void>;
};

let handler: ReturnType<typeof serverless> | null = null;
let initError: string | null = null;

async function getHandler(): Promise<ReturnType<typeof serverless>> {
  if (initError) throw new Error(initError);
  if (handler) return handler;

  try {
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
        hint: "Verifique DATABASE_URL, prisma db push e variáveis em Vercel → Environment Variables."
      });
    }
  }
}
