import { Router } from "express";
import { env, getMetaAccessToken, getMetaRedirectUri, isMetaOAuthConfigured } from "../../config/env";
import { clearStoredMetaToken, getMetaTokenFilePath, loadStoredMetaToken } from "../../config/meta-token.store";
import { requireOperatorAccess } from "../../common/security";
import { MetaApiService } from "./services/meta-api.service";
import {
  buildOAuthLoginUrl,
  createOAuthState,
  debugToken,
  exchangeCodeForAccessToken,
  exchangeShortLivedAccessToken,
  getOAuthScopes,
  validateOAuthState
} from "./services/meta-oauth.service";
import { MetaGraphRequestError } from "./services/meta-graph.client";
import { syncMetaAssetsFromGraph } from "./services/meta-assets.service";
import { getEffectiveMetaIds } from "../../config/meta-runtime";
import { getMetaAssetsFilePath } from "../../config/meta-assets.store";

export const metaRouter = Router();
const metaApi = new MetaApiService();

metaRouter.get("/status", (_req, res) => {
  const stored = loadStoredMetaToken();
  const ids = getEffectiveMetaIds();
  res.json({
    appId: env.META_APP_ID || null,
    appName: "Phoenix Marketing Automat",
    apiVersion: env.META_API_VERSION,
    redirectUri: getMetaRedirectUri(),
    oauthConfigured: isMetaOAuthConfigured(),
    hasAccessToken: Boolean(getMetaAccessToken()),
    tokenSource: env.metaTokenFromFile ? "file" : getMetaAccessToken() ? "env" : "none",
    tokenFile: getMetaTokenFilePath(),
    tokenObtainedAt: stored?.obtainedAt ?? null,
    tokenExpiresAt: stored?.expiresAt ?? null,
    whatsappReady: Boolean(getMetaAccessToken() && ids.whatsappPhoneNumberId),
    instagramReady: Boolean(getMetaAccessToken() && ids.instagramBusinessAccountId),
    marketingReady: Boolean(getMetaAccessToken()),
    adAccountId: ids.adAccountId ?? null,
    pageId: ids.pageId ?? null,
    instagramBusinessAccountId: ids.instagramBusinessAccountId ?? null,
    whatsappPhoneNumberId: ids.whatsappPhoneNumberId ?? null,
    assetsFile: getMetaAssetsFilePath(),
    assetsSyncedAt: ids.assetsSyncedAt,
    webhookVerifyTokenSet: Boolean(env.META_WEBHOOK_VERIFY_TOKEN?.trim())
  });
});

metaRouter.get("/oauth/scopes", (_req, res) => {
  res.json({ scopes: getOAuthScopes().split(",") });
});

metaRouter.post("/oauth/sdk-token", async (req, res) => {
  const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken.trim() : "";
  if (!accessToken) {
    res.status(400).json({ error: "accessToken é obrigatório." });
    return;
  }

  try {
    const stored = await exchangeShortLivedAccessToken(accessToken);
    let assets: Record<string, unknown> | undefined;
    try {
      assets = (await syncMetaAssetsFromGraph()) as Record<string, unknown>;
    } catch {
      assets = undefined;
    }
    res.json({
      ok: true,
      message: "Token Meta salvo no servidor.",
      obtainedAt: stored.obtainedAt,
      expiresAt: stored.expiresAt,
      assets
    });
  } catch (error) {
    const message =
      error instanceof MetaGraphRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Falha ao salvar token.";
    res.status(502).json({ ok: false, error: message });
  }
});

metaRouter.get("/oauth/login", (_req, res) => {
  try {
    const state = createOAuthState();
    const url = buildOAuthLoginUrl(state);
    res.redirect(url);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Falha ao iniciar OAuth Meta."
    });
  }
});

metaRouter.get("/oauth/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const oauthError = typeof req.query.error === "string" ? req.query.error : undefined;

  if (oauthError) {
    res.status(400).type("html").send(renderOAuthHtml(false, `Meta retornou erro: ${oauthError}`));
    return;
  }

  if (!code || !validateOAuthState(state)) {
    res.status(400).type("html").send(renderOAuthHtml(false, "Código ou state OAuth inválido/expirado."));
    return;
  }

  try {
    const stored = await exchangeCodeForAccessToken(code);
    let assets: Record<string, unknown> | undefined;
    try {
      assets = (await syncMetaAssetsFromGraph()) as Record<string, unknown>;
    } catch {
      assets = undefined;
    }
    let debug: Record<string, unknown> | undefined;
    try {
      debug = await debugToken(stored.accessToken);
    } catch {
      debug = undefined;
    }

    res
      .status(200)
      .type("html")
      .send(
        renderOAuthHtml(
          true,
          "Token salvo com sucesso. Reinicie a API se o status ainda mostrar token ausente.",
          { obtainedAt: stored.obtainedAt, expiresAt: stored.expiresAt, assets, debug }
        )
      );
  } catch (error) {
    const message =
      error instanceof MetaGraphRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Falha no OAuth.";
    res.status(500).type("html").send(renderOAuthHtml(false, message));
  }
});

metaRouter.post("/oauth/logout", requireOperatorAccess, (_req, res) => {
  clearStoredMetaToken();
  res.json({ ok: true, message: "Token local removido. META_ACCESS_TOKEN no .env permanece se definido." });
});

metaRouter.get("/me", requireOperatorAccess, async (_req, res) => {
  res.json(await metaApi.getMe());
});

metaRouter.get("/adaccounts", requireOperatorAccess, async (_req, res) => {
  res.json(await metaApi.listAdAccounts());
});

metaRouter.post("/campaigns", requireOperatorAccess, async (req, res) => {
  const adAccountId = String(req.body?.adAccountId ?? env.META_AD_ACCOUNT_ID ?? "");
  const result = await metaApi.createCampaign({
    adAccountId,
    name: String(req.body?.name ?? "Phoenix Campaign"),
    objective: req.body?.objective ? String(req.body.objective) : undefined,
    status: req.body?.status === "ACTIVE" ? "ACTIVE" : "PAUSED"
  });
  res.status(result.ok ? 200 : 502).json(result);
});

metaRouter.post("/sync-assets", requireOperatorAccess, async (_req, res) => {
  try {
    const assets = await syncMetaAssetsFromGraph();
    res.json({ ok: true, assets, file: getMetaAssetsFilePath() });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao sincronizar ativos Meta."
    });
  }
});

metaRouter.post("/publish-instagram", requireOperatorAccess, async (req, res) => {
  const caption = String(req.body?.caption ?? "");
  const imageUrl = String(req.body?.imageUrl ?? "");
  if (!caption || !imageUrl) {
    res.status(400).json({ error: "caption e imageUrl são obrigatórios." });
    return;
  }
  const result = await metaApi.publishInstagramPost({ caption, imageUrl });
  res.status(result.ok ? 200 : 502).json(result);
});

metaRouter.post("/insights", requireOperatorAccess, async (req, res) => {
  const objectId = String(req.body?.objectId ?? req.body?.campaignId ?? env.META_AD_ACCOUNT_ID ?? "");
  const result = await metaApi.fetchAdsInsights({
    objectId,
    fields: req.body?.fields ? String(req.body.fields) : undefined,
    datePreset: req.body?.datePreset ? String(req.body.datePreset) : "last_7d",
    breakdowns: req.body?.breakdowns ? String(req.body.breakdowns) : undefined
  });
  res.status(result.ok ? 200 : 502).json(result);
});

function renderOAuthHtml(
  success: boolean,
  message: string,
  extra?: {
    obtainedAt?: string;
    expiresAt?: string | null;
    assets?: Record<string, unknown>;
    debug?: Record<string, unknown>;
  }
): string {
  const title = success ? "Phoenix — Meta conectado" : "Phoenix — Erro OAuth";
  const extraBlock = extra
    ? `<pre>${escapeHtml(JSON.stringify(extra, null, 2))}</pre>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem}
.ok{color:#0a0}.err{color:#c00}pre{background:#1111;padding:1rem;border-radius:8px;overflow:auto;font-size:0.85rem}
a{color:#06c}</style></head>
<body>
<h1 class="${success ? "ok" : "err"}">${title}</h1>
<p>${escapeHtml(message)}</p>
${extraBlock}
<p><a href="/dev/emulator">Abrir emulador</a> · <a href="/api/meta/status">Ver status JSON</a></p>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
