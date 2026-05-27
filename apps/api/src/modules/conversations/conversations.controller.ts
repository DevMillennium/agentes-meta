import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../common/prisma";
import { MetaApiService } from "../meta/services/meta-api.service";

export const conversationsRouter = Router();
const metaApi = new MetaApiService();

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4096)
});

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

conversationsRouter.post("/:id/messages", async (req, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { lead: true }
  });
  if (!conversation) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }

  const recipientId =
    conversation.channel === "whatsapp"
      ? conversation.lead.phone
      : conversation.lead.instagramHandle;

  let delivery: Record<string, unknown> | undefined;
  if (recipientId) {
    const result =
      conversation.channel === "whatsapp"
        ? await metaApi.sendWhatsAppTextMessage(recipientId, parsed.data.content)
        : await metaApi.sendInstagramTextMessage(recipientId, parsed.data.content);
    delivery = { ...result };
    if (!result.ok) {
      res.status(502).json({ error: "Falha ao enviar via Meta.", delivery });
      return;
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      content: parsed.data.content
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() }
  });

  res.status(201).json({ message, delivery: delivery ?? null });
});
