import { LeadTemperature } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../common/prisma";

export const leadsRouter = Router();

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  instagramHandle: z.string().optional(),
  city: z.string().optional(),
  status: z.string().min(1).optional(),
  temperature: z.enum(["COLD", "WARM", "HOT"]).optional(),
  nextAction: z.string().optional(),
  productId: z.string().nullable().optional()
});

leadsRouter.get("/stats/summary", async (_req, res) => {
  const [total, hot, warm, cold, awaitingHuman] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { temperature: LeadTemperature.HOT } }),
    prisma.lead.count({ where: { temperature: LeadTemperature.WARM } }),
    prisma.lead.count({ where: { temperature: LeadTemperature.COLD } }),
    prisma.lead.count({ where: { status: "aguardando_humano" } })
  ]);
  res.json({ total, hot, warm, cold, awaitingHuman });
});

leadsRouter.get("/", async (req, res) => {
  const temperature =
    typeof req.query.temperature === "string" ? req.query.temperature : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = Math.min(Number(req.query.limit ?? 100), 200);

  const items = await prisma.lead.findMany({
    where: {
      ...(temperature ? { temperature: temperature as LeadTemperature } : {}),
      ...(status ? { status } : {})
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      product: { select: { id: true, name: true } },
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } }
      },
      _count: { select: { conversations: true } }
    }
  });
  res.json({ items, total: items.length });
});

function pipelineColumn(status: string, temperature: string): string {
  if (status === "aguardando_humano") return "humano";
  if (status === "lead_quente" || temperature === "HOT") return "quente";
  if (status === "qualificando" || temperature === "WARM") return "qualificando";
  if (status === "new" || status === "novo") return "novo";
  return "qualificando";
}

leadsRouter.get("/board", async (_req, res) => {
  const items = await prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      product: { select: { id: true, name: true } },
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } }
      }
    }
  });

  const columns: Record<string, typeof items> = {
    novo: [],
    qualificando: [],
    quente: [],
    humano: []
  };

  for (const lead of items) {
    const col = pipelineColumn(lead.status, lead.temperature);
    columns[col].push(lead);
  }

  res.json({
    columns: [
      { id: "novo", title: "Novo", items: columns.novo },
      { id: "qualificando", title: "Qualificando (IA)", items: columns.qualificando },
      { id: "quente", title: "Quente", items: columns.quente },
      { id: "humano", title: "Aguardando humano", items: columns.humano }
    ],
    total: items.length
  });
});

leadsRouter.get("/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      product: true,
      conversations: {
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { sentAt: "asc" } } }
      }
    }
  });
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }
  res.json(lead);
});

leadsRouter.patch("/:id", async (req, res) => {
  const parsed = updateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: parsed.data
  });
  res.json(lead);
});
