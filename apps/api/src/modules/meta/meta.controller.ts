import { Router } from "express";
import {
  env,
  getApiPublicUrl,
  getMetaAccessToken,
  getMetaRedirectUri,
  getWebAppUrl,
  isMetaOAuthConfigured
} from "../../config/env";
import {
  clearUserMetaToken,
  loadUserMetaToken
} from "../../config/meta-token.service";
import {
  requireAuth,
  requireOperatorAccess,
  type AuthenticatedRequest
} from "../../common/security";
import { runWithUserContext } from "../../common/request-context";
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

export const metaRouter = Router();
const metaApi = new MetaApiService();

function sessionPayload(userId?: string) {
  const ids = getEffectiveMetaIds();
  return {
    oauthLoginUrl: "/api/meta/oauth/login-url",
    sdkTokenUrl: "/api/meta/oauth/sdk-token",
    syncAssetsUrl: "/api/meta/sync-assets",
    hasAccessToken: Boolean(getMetaAccessToken()),
    tokenObtainedAt: null as string | null,
    userId: userId ?? null,
    ...ids,
    scopes: getOAuthScopes().split(",")
  };
}

function buildMetaProductionReadiness(userHasStoredToken: boolean) {
  const apiPublicUrl = getApiPublicUrl();
  const ids = getEffectiveMetaIds();
  const hasToken = Boolean(getMetaAccessToken());
  const oauthConfigured = isMetaOAuthConfigured();
  const webhookTokenSet = Boolean(env.META_WEBHOOK_VERIFY_TOKEN?.trim());
  const webhookVerifySamples = {
    whatsapp: `${apiPublicUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_VERIFY_TOKEN&hub.challenge=ok`,
    instagram: `${apiPublicUrl}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=SEU_VERIFY_TOKEN&hub.challenge=ok`
  };

  const checks = {
    oauthConfigured,
    hasToken,
    tokenSource: userHasStoredToken ? "database" : hasToken ? "env" : "none",
    webhookVerifyTokenSet: webhookTokenSet,
    apiPublicUrlIsHttps: apiPublicUrl.startsWith("https://"),
    pageIdReady: Boolean(ids.pageId),
    whatsappReady: Boolean(ids.whatsappPhoneNumberId),
    instagramReady: Boolean(ids.instagramBusinessAccountId)
  };

  const missing: string[] = [];
  if (!oauthConfigured) missing.push("Configurar META_APP_ID e META_APP_SECRET.");
  if (!checks.apiPublicUrlIsHttps) missing.push("Definir API_PUBLIC_URL com https em produção.");
  if (!webhookTokenSet) missing.push("Definir META_WEBHOOK_VERIFY_TOKEN.");
  if (!hasToken) missing.push("Conectar token Meta via OAuth no console.");
  if (!checks.pageIdReady) missing.push("Sincronizar ativos para obter META_PAGE_ID.");

  const nextSteps = [
    "1) No Console, executar conexão OAuth da Meta.",
    "2) Executar POST /api/meta/sync-assets.",
    "3) Configurar callback e webhooks no app Meta com as URLs retornadas.",
    "4) Validar GET /api/meta/status e este readiness até ficar ok=true."
  ];

  return {
    ok: missing.length === 0,
    apiPublicUrl,
    redirectUri: getMetaRedirectUri(),
    webhookVerifySamples,
    checks,
    metaIds: {
      adAccountId: ids.adAccountId ?? null,
      pageId: ids.pageId ?? null,
      whatsappPhoneNumberId: ids.whatsappPhoneNumberId ?? null,
      instagramBusinessAccountId: ids.instagramBusinessAccountId ?? null,
      assetsSyncedAt: ids.assetsSyncedAt
    },
    scopes: getOAuthScopes().split(","),
    missing,
    nextSteps
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof MetaGraphRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Erro desconhecido";
}

metaRouter.get("/session", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  const stored = userId ? await loadUserMetaToken(userId) : null;
  res.json({
    ...sessionPayload(userId),
    hasAccessToken: Boolean(getMetaAccessToken()),
    tokenObtainedAt: stored?.obtainedAt ?? null
  });
});

metaRouter.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  const stored = userId ? await loadUserMetaToken(userId) : null;
  const ids = getEffectiveMetaIds();
  res.json({
    appId: env.META_APP_ID || null,
    appName: "Phoenix Marketing Automat",
    apiVersion: env.META_API_VERSION,
    redirectUri: getMetaRedirectUri(),
    oauthConfigured: isMetaOAuthConfigured(),
    hasAccessToken: Boolean(getMetaAccessToken()),
    tokenSource: stored ? "database" : getMetaAccessToken() ? "env" : "none",
    userId: userId ?? null,
    tokenObtainedAt: stored?.obtainedAt ?? null,
    tokenExpiresAt: stored?.expiresAt ?? null,
    whatsappReady: Boolean(getMetaAccessToken() && ids.whatsappPhoneNumberId),
    instagramReady: Boolean(getMetaAccessToken() && ids.instagramBusinessAccountId),
    marketingReady: Boolean(getMetaAccessToken()),
    adAccountId: ids.adAccountId ?? null,
    pageId: ids.pageId ?? null,
    instagramBusinessAccountId: ids.instagramBusinessAccountId ?? null,
    whatsappPhoneNumberId: ids.whatsappPhoneNumberId ?? null,
    assetsSyncedAt: ids.assetsSyncedAt,
    webhookVerifyTokenSet: Boolean(env.META_WEBHOOK_VERIFY_TOKEN?.trim())
  });
});

metaRouter.get("/production-readiness", requireOperatorAccess, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  const stored = userId ? await loadUserMetaToken(userId) : null;
  res.json(buildMetaProductionReadiness(Boolean(stored)));
});

metaRouter.get("/oauth/scopes", (_req, res) => {
  res.json({ scopes: getOAuthScopes().split(",") });
});

metaRouter.post("/oauth/sdk-token", requireOperatorAccess, async (req: AuthenticatedRequest, res) => {
  const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken.trim() : "";
  const userId = req.user?.userId;
  if (!accessToken || !userId) {
    res.status(400).json({ error: "accessToken e usuário autenticado são obrigatórios." });
    return;
  }

  try {
    const stored = await exchangeShortLivedAccessToken(accessToken, userId);
    let assets: Record<string, unknown> | undefined;
    try {
      assets = (await syncMetaAssetsFromGraph()) as Record<string, unknown>;
    } catch {
      assets = undefined;
    }
    res.json({
      ok: true,
      message: "Token Meta salvo para sua conta.",
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

/** URL OAuth assinada para o usuário logado (multi-tenant). */
metaRouter.get("/oauth/login-url", requireOperatorAccess, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Usuário não autenticado." });
      return;
    }
    const state = createOAuthState(userId);
    res.json({ url: buildOAuthLoginUrl(state), state });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Falha ao gerar URL OAuth."
    });
  }
});

metaRouter.get("/oauth/login", requireOperatorAccess, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Usuário não autenticado." });
      return;
    }
    const state = createOAuthState(userId);
    res.redirect(buildOAuthLoginUrl(state));
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
  const webApp = getWebAppUrl();

  if (oauthError) {
    res
      .status(400)
      .type("html")
      .send(renderOAuthHtml(false, `Meta retornou erro: ${oauthError}`, webApp));
    return;
  }

  const userId = validateOAuthState(state);
  if (!code || !userId) {
    res
      .status(400)
      .type("html")
      .send(renderOAuthHtml(false, "Código ou state OAuth inválido/expirado.", webApp));
    return;
  }

  try {
    const token = await exchangeCodeForAccessToken(code, userId);
    let assets: Record<string, unknown> | undefined;
    try {
      assets = await new Promise<Record<string, unknown>>((resolve, reject) => {
        runWithUserContext(userId, { metaAccessToken: token.accessToken }, () => {
          void syncMetaAssetsFromGraph()
            .then((value) => resolve(value as Record<string, unknown>))
            .catch(reject);
        });
      });
    } catch {
      assets = undefined;
    }
    const stored = { token, assets };

    let debug: Record<string, unknown> | undefined;
    try {
      debug = await debugToken(stored.token.accessToken);
    } catch {
      debug = undefined;
    }

    res
      .status(200)
      .type("html")
      .send(
        renderOAuthHtml(
          true,
          "Conta Meta conectada com sucesso para o seu usuário.",
          webApp,
          {
            obtainedAt: stored.token.obtainedAt,
            expiresAt: stored.token.expiresAt,
            assets: stored.assets,
            debug
          }
        )
      );
  } catch (error) {
    const message =
      error instanceof MetaGraphRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Falha no OAuth.";
    res.status(500).type("html").send(renderOAuthHtml(false, message, webApp));
  }
});

metaRouter.post("/oauth/logout", requireOperatorAccess, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  if (userId) await clearUserMetaToken(userId);
  res.json({ ok: true, message: "Token Meta removido da sua conta." });
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
    const subscriptions = {
      instagram: await metaApi.subscribeInstagramWebhooks(),
      whatsapp: await metaApi.subscribeWhatsAppWebhooks()
    };
    res.json({ ok: true, assets, subscriptions });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao sincronizar ativos Meta."
    });
  }
});

metaRouter.post("/bootstrap", requireOperatorAccess, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  const stored = userId ? await loadUserMetaToken(userId) : null;
  const readinessBefore = buildMetaProductionReadiness(Boolean(stored));
  const steps: Record<string, unknown> = {};

  if (!readinessBefore.checks.oauthConfigured) {
    res.status(400).json({
      ok: false,
      message: "META_APP_ID/META_APP_SECRET não configurados. Corrija o ambiente e execute novamente.",
      readinessBefore,
      steps
    });
    return;
  }

  const accessToken = getMetaAccessToken();
  if (!accessToken) {
    let oauthLoginUrl: string | null = null;
    try {
      if (userId) {
        oauthLoginUrl = buildOAuthLoginUrl(createOAuthState(userId));
      }
    } catch {
      oauthLoginUrl = null;
    }
    res.status(409).json({
      ok: false,
      message: "Token Meta ausente. Conecte via OAuth e rode novamente.",
      oauthLoginUrl,
      readinessBefore,
      steps
    });
    return;
  }

  try {
    steps.tokenDebug = await debugToken(accessToken);
  } catch (error) {
    steps.tokenDebugError = getErrorMessage(error);
  }

  let assets: Record<string, unknown> | undefined;
  try {
    assets = (await syncMetaAssetsFromGraph()) as Record<string, unknown>;
    steps.syncAssets = { ok: true, assets };
  } catch (error) {
    steps.syncAssets = { ok: false, error: getErrorMessage(error) };
  }

  try {
    steps.subscribeInstagram = await metaApi.subscribeInstagramWebhooks();
  } catch (error) {
    steps.subscribeInstagram = { ok: false, error: getErrorMessage(error) };
  }

  try {
    steps.subscribeWhatsApp = await metaApi.subscribeWhatsAppWebhooks();
  } catch (error) {
    steps.subscribeWhatsApp = { ok: false, error: getErrorMessage(error) };
  }

  try {
    steps.me = await metaApi.getMe();
  } catch (error) {
    steps.me = { ok: false, error: getErrorMessage(error) };
  }

  try {
    steps.adAccounts = await metaApi.listAdAccounts();
  } catch (error) {
    steps.adAccounts = { ok: false, error: getErrorMessage(error) };
  }

  const readinessAfter = buildMetaProductionReadiness(Boolean(stored || accessToken));
  res.json({
    ok: readinessAfter.ok,
    message: readinessAfter.ok
      ? "Bootstrap Meta concluído com sucesso."
      : "Bootstrap executado com pendências (veja missing/readinessAfter).",
    readinessBefore,
    readinessAfter,
    steps
  });
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
  webAppUrl: string,
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
.ok{color:#0a0}.err{color:#c00}pre{background:#f2f4f7;padding:1rem;border-radius:8px;overflow:auto;font-size:0.85rem}
a{color:#06c}</style></head>
<body>
<h1 class="${success ? "ok" : "err"}">${title}</h1>
<p>${escapeHtml(message)}</p>
${extraBlock}
<p><a href="${escapeHtml(webAppUrl)}/configuracoes/meta">Voltar ao painel</a></p>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
