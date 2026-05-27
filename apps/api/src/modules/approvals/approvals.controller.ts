import { Router } from "express";
import { ApprovalStatus, RiskLevel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma";

export const approvalsRouter = Router();

const createApprovalSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  requestedBy: z.string().min(2),
  requestedData: z.unknown().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM")
});

const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CHANGED"]),
  decidedById: z.string().min(1),
  description: z.string().optional(),
  requestedData: z.unknown().optional()
});

approvalsRouter.get("/", async (_req, res) => {
  const items = await prisma.approvalRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ items });
});

approvalsRouter.post("/", async (req, res) => {
  const parsed = createApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const approval = await prisma.approvalRequest.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      requestedBy: parsed.data.requestedBy,
      requestedData: parsed.data.requestedData as object | undefined,
      riskLevel: parsed.data.riskLevel as RiskLevel
    }
  });

  res.status(201).json(approval);
});

approvalsRouter.post("/:id/decide", async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.approvalRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Solicitação de aprovação não encontrada." });
    return;
  }

  const approval = await prisma.approvalRequest.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status as ApprovalStatus,
      decidedById: parsed.data.decidedById,
      decidedAt: new Date(),
      ...(parsed.data.description ? { description: parsed.data.description } : {}),
      ...(parsed.data.requestedData !== undefined
        ? { requestedData: parsed.data.requestedData as object }
        : {})
    }
  });

  res.json(approval);
});
