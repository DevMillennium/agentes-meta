import type { Express } from "express";

/** Auth compartilhada entre hub, console, CRM e emulador (mesmo origin). */
export const BROWSER_AUTH_JS = `
window.PhoenixAuth = (function () {
  const TOKEN_KEY = "phoenix_access_token";
  const LEGACY_TOKEN_KEY = "phoenix_console_jwt";
  const API_KEY_KEY = "phoenix_api_key";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  }

  function getApiKey() {
    return localStorage.getItem(API_KEY_KEY) || "";
  }

  function saveSession(accessToken, apiKey) {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
    }
    if (apiKey) localStorage.setItem(API_KEY_KEY, apiKey);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(API_KEY_KEY);
  }

  function headers(extra) {
    const h = { "content-type": "application/json", ...(extra || {}) };
    const token = getToken();
    const apiKey = getApiKey();
    if (token) h.authorization = "Bearer " + token;
    if (apiKey) h["x-api-key"] = apiKey;
    return h;
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      ...opts,
      headers: headers(opts && opts.headers)
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  }

  async function loginWithPassword(email, password) {
    const r = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (r.ok && r.body && r.body.accessToken) {
      saveSession(r.body.accessToken, getApiKey());
      return r;
    }
    return r;
  }

  async function loginWithApiKey(apiKey) {
    saveSession(null, apiKey);
    const r = await api("/api/auth/me");
    if (r.ok) return r;
    clearSession();
    return r;
  }

  async function loadMe() {
    return api("/api/auth/me");
  }

  return {
    TOKEN_KEY,
    API_KEY_KEY,
    getToken,
    getApiKey,
    saveSession,
    clearSession,
    headers,
    api,
    loginWithPassword,
    loginWithApiKey,
    loadMe
  };
})();
`;

export function registerBrowserAuthRoutes(app: Express): void {
  app.get("/shared/auth.js", (_req, res) => {
    res.type("application/javascript; charset=utf-8").send(BROWSER_AUTH_JS);
  });
}
