import { env, getApiPublicUrl, getMetaRedirectUri, getWebAppUrl } from "../../../config/env";
import { META_OAUTH_SCOPE_LIST, META_OAUTH_SCOPES } from "../../../config/meta-oauth-scopes";

const META_APP_ID = "27447238071580159";
const META_BUSINESS_ID = "1078327696794532";

const DEFAULT_PROD_API_URLS = [
  "https://phoenix-marketing-api.vercel.app",
  "https://phoenix-marketing-api-millenniumomnichannel-4893s-projects.vercel.app"
];

const DEFAULT_PROD_WEB_URLS = [
  "https://phoenix-marketing-web.vercel.app",
  "https://phoenix-marketing-web-millenniumomnichannel-4893s-projects.vercel.app"
];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function buildRedirectUris(apiBaseUrls: string[]): string[] {
  return uniqueStrings(
    apiBaseUrls.flatMap((base) => `${base.replace(/\/$/, "")}/api/meta/oauth/callback`)
  );
}

export function buildMetaConsoleConfig(extra?: {
  prodApiUrls?: string[];
  prodWebUrls?: string[];
}) {
  const apiPublic = getApiPublicUrl();
  const webApp = getWebAppUrl();
  const prodApiUrls = uniqueStrings([
    apiPublic,
    ...(extra?.prodApiUrls ?? DEFAULT_PROD_API_URLS)
  ]);
  const prodWebUrls = uniqueStrings([
    webApp,
    ...(extra?.prodWebUrls ?? DEFAULT_PROD_WEB_URLS)
  ]);

  const redirectUris = buildRedirectUris(prodApiUrls);
  const appDomains = uniqueStrings([
    "localhost",
    ...prodWebUrls.map(hostFromUrl).filter((h): h is string => Boolean(h)),
    ...prodApiUrls.map(hostFromUrl).filter((h): h is string => Boolean(h))
  ]);
  const jsSdkHosts = uniqueStrings([
    "localhost",
    "127.0.0.1",
    ...prodWebUrls.map(hostFromUrl).filter((h): h is string => Boolean(h))
  ]);

  const webhookBase = apiPublic.replace(/\/$/, "");
  const verifyToken = env.META_WEBHOOK_VERIFY_TOKEN?.trim() || "";

  return {
    appId: env.META_APP_ID?.trim() || META_APP_ID,
    appName: "Phoenix Marketing Automat",
    businessId: META_BUSINESS_ID,
    apiVersion: env.META_API_VERSION,
    oauthScopes: META_OAUTH_SCOPES.split(","),
    oauthScopesCsv: META_OAUTH_SCOPES,
    redirectUriPrimary: getMetaRedirectUri(),
    facebookDevelopers: {
      basic: `https://developers.facebook.com/apps/${META_APP_ID}/settings/basic/?business_id=${META_BUSINESS_ID}`,
      advanced: `https://developers.facebook.com/apps/${META_APP_ID}/settings/advanced/?business_id=${META_BUSINESS_ID}`,
      facebookLogin: `https://developers.facebook.com/apps/${META_APP_ID}/fb-login/settings/?business_id=${META_BUSINESS_ID}`,
      webhooks: `https://developers.facebook.com/apps/${META_APP_ID}/webhooks/?business_id=${META_BUSINESS_ID}`
    },
    facebookLoginSettings: {
      clientOAuthLogin: true,
      webOAuthLogin: true,
      enforceHttps: true,
      validOAuthRedirectUris: redirectUris,
      allowedDomainsForJavaScriptSdk: jsSdkHosts,
      loginFromDevices: true
    },
    appSettings: {
      appDomains,
      websiteUrl: webApp || "http://localhost:3000",
      privacyPolicyUrl: webApp ? `${webApp}/privacidade` : "http://localhost:3000/privacidade",
      termsOfServiceUrl: webApp ? `${webApp}/termos` : "http://localhost:3000/termos"
    },
    webhooks: {
      verifyToken,
      callbackUrls: {
        whatsapp: `${webhookBase}/webhooks/whatsapp`,
        instagram: `${webhookBase}/webhooks/instagram`
      },
      verifySamples: {
        whatsapp: `${webhookBase}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=ok`,
        instagram: `${webhookBase}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=ok`
      }
    },
    phoenixEnv: {
      META_APP_ID: env.META_APP_ID,
      META_REDIRECT_URI: env.META_REDIRECT_URI?.trim() || redirectUris[0],
      API_PUBLIC_URL: apiPublic,
      WEB_APP_URL: webApp,
      NEXT_PUBLIC_META_APP_ID: env.META_APP_ID,
      NEXT_PUBLIC_API_URL: apiPublic
    },
    checklist: [
      `Facebook Login → URIs de redirecionamento: ${redirectUris.join(", ")}`,
      `Facebook Login → Domínios permitidos do SDK JS: ${jsSdkHosts.join(", ")}`,
      `Configurações básicas → Domínios do app: ${appDomains.join(", ")}`,
      `Webhooks → Verify token = ${verifyToken || "(defina META_WEBHOOK_VERIFY_TOKEN)"}`,
      `Webhooks → Callback WhatsApp: ${webhookBase}/webhooks/whatsapp`,
      `Webhooks → Callback Instagram: ${webhookBase}/webhooks/instagram`,
      `Permissões OAuth alinhadas (${META_OAUTH_SCOPE_LIST.length} escopos) — ver GET /api/meta/oauth/scopes`
    ]
  };
}
