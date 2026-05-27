import { Router } from "express";
import { prisma } from "../../common/prisma";

export const conversationsRouter = Router();

conversationsRouter.get("/stats/summary", async (_req, res) => {
  const [leads, conversations, messages, approvals, campaigns, products] = await Promise.all([
    prisma.lead.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
    prisma.campaign.count(),
    prisma.product.count({ where: { status: "ACTIVE" } })
  ]);

  res.json({
    leads,
    conversations,
    messages,
    pendingApprovals: approvals,
    campaigns,
    activeProducts: products
  });
});

conversationsRouter.get("/", async (_req, res) => {
  const items = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      lead: true,
      messages: { orderBy: { sentAt: "desc" }, take: 1 }
    }
  });
  res.json({ items });
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { sentAt: "asc" }
  });
  res.json({ items: messages });
});
