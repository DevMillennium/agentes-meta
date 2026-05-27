import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

interface ApprovalRecord {
  id: string;
  title: string;
  description: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGED";
  requestedBy: string;
  requestedData?: object;
  decidedById?: string | null;
  decidedAt?: Date | null;
  createdAt: Date;
}

const approvalStore: ApprovalRecord[] = [];

vi.mock("../../common/prisma", () => ({
  prisma: {
    approvalRequest: {
      findMany: vi.fn(async () => [...approvalStore].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
      create: vi.fn(async ({ data }: { data: Omit<ApprovalRecord, "id" | "status" | "createdAt"> & { status?: ApprovalRecord["status"] } }) => {
        const item: ApprovalRecord = {
          id: `apr_${approvalStore.length + 1}`,
          title: data.title,
          description: data.description,
          requestedBy: data.requestedBy,
          requestedData: data.requestedData,
          riskLevel: data.riskLevel,
          status: data.status ?? "PENDING",
          decidedById: null,
          decidedAt: null,
          createdAt: new Date()
        };
        approvalStore.push(item);
        return item;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => approvalStore.find((item) => item.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<ApprovalRecord> }) => {
        const index = approvalStore.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error("Approval not found");
        approvalStore[index] = { ...approvalStore[index], ...data };
        return approvalStore[index];
      })
    }
  }
}));

let buildApp: (() => express.Express) | null = null;

async function getAuthToken(app: express.Express): Promise<string> {
  const login = await request(app).post("/api/auth/login").send({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  });
  return login.body.accessToken as string;
}

describe("approvals integration flow", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.PORT = "4100";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?schema=public";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.API_CORS_ORIGIN = "http://localhost:3000";
    process.env.ADMIN_API_KEY = "1234567890abcdef-admin-key";
    process.env.ADMIN_EMAIL = "admin@phoenixglobal.com.br";
    process.env.ADMIN_PASSWORD = "super-secret-password";
    process.env.JWT_SECRET = "jwt-secret-very-strong-test";
    process.env.JWT_EXPIRES_IN = "12h";
    process.env.ENABLE_WORKERS = "false";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.META_APP_ID = "27447238071580159";
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.META_API_VERSION = "v25.0";
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-token-test";

    const imported = await import("../../app");
    buildApp = imported.createApp;
  });

  beforeEach(() => {
    approvalStore.splice(0, approvalStore.length);
  });

  it("bloqueia acesso sem autenticação", async () => {
    const app = buildApp?.();
    if (!app) throw new Error("App não inicializado.");

    const response = await request(app).get("/api/approvals");
    expect(response.status).toBe(401);
  });

  it("cria, lista e decide solicitações com JWT", async () => {
    const app = buildApp?.();
    if (!app) throw new Error("App não inicializado.");

    const token = await getAuthToken(app);

    const created = await request(app)
      .post("/api/approvals")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Aprovar orçamento campanha AirPods",
        description: "Solicitação para validar orçamento máximo de R$ 50/dia",
        requestedBy: "admin-local",
        riskLevel: "MEDIUM",
        requestedData: { campaignType: "messages" }
      });

    expect(created.status).toBe(201);
    expect(created.body.status).toBe("PENDING");

    const listed = await request(app).get("/api/approvals").set("Authorization", `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.items)).toBe(true);
    expect(listed.body.items.length).toBe(1);

    const decided = await request(app)
      .post(`/api/approvals/${created.body.id}/decide`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "APPROVED",
        decidedById: "admin-local",
        description: "Aprovado para execução controlada."
      });

    expect(decided.status).toBe(200);
    expect(decided.body.approval.status).toBe("APPROVED");
    expect(decided.body.approval.decidedById).toBe("admin-local");
  });
});
