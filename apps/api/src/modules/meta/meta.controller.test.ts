import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./services/meta-oauth.service", () => ({
  createOAuthState: vi.fn(() => "test-state"),
  validateOAuthState: vi.fn(() => true),
  buildOAuthLoginUrl: vi.fn(
    () => "https://www.facebook.com/v25.0/dialog/oauth?client_id=test"
  ),
  exchangeCodeForAccessToken: vi.fn(async () => ({
    accessToken: "stored-token",
    obtainedAt: new Date().toISOString(),
    expiresAt: null
  })),
  debugToken: vi.fn(async () => ({ data: { is_valid: true } }))
}));

let buildApp: (() => express.Express) | null = null;

describe("meta controller", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.PORT = "4101";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?schema=public";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.API_CORS_ORIGIN = "http://localhost:3000";
    process.env.ADMIN_API_KEY = "1234567890abcdef-admin-key";
    process.env.ADMIN_EMAIL = "admin@phoenixglobal.com.br";
    process.env.ADMIN_PASSWORD = "super-secret-password";
    process.env.JWT_SECRET = "jwt-secret-very-strong-test";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.META_APP_ID = "27447238071580159";
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-token-test";
    process.env.META_API_VERSION = "v25.0";

    const imported = await import("../../app");
    buildApp = imported.createApp;
  });

  it("retorna status da integração Meta", async () => {
    const app = buildApp?.();
    if (!app) throw new Error("App não inicializado.");

    const res = await request(app).get("/api/meta/status");
    expect(res.status).toBe(200);
    expect(res.body.appId).toBe("27447238071580159");
    expect(res.body.oauthConfigured).toBe(true);
  });

  it("redireciona para login OAuth", async () => {
    const app = buildApp?.();
    if (!app) throw new Error("App não inicializado.");

    const res = await request(app).get("/api/meta/oauth/login");
    expect(res.status).toBe(302);
    expect(res.header.location).toContain("facebook.com");
  });
});
