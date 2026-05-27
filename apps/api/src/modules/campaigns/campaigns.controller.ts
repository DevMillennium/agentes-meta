import { Router } from "express";
import { prisma } from "../../common/prisma";
import { MetaApiService } from "../meta/services/meta-api.service";

export const campaignsRouter = Router();
const metaApi = new MetaApiService();

campaignsRouter.get("/", async (_req, res) => {
  const items = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      metaAdAccount: true,
      adSets: { include: { ads: { include: { creative: true } } } }
    }
  });
  res.json({ items });
});

campaignsRouter.get("/creatives", async (_req, res) => {
  const items = await prisma.creative.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: true }
  });
  res.json({ items });
});

campaignsRouter.post("/diagnose", async (req, res) => {
  const insights = await metaApi.fetchAdsInsightsPlaceholder(req.body ?? {});
  const accounts = metaApi.hasAccessToken() ? await metaApi.listAdAccounts() : null;
  res.json({
    diagnosis: insights.ok ? "Insights reais da Marketing API." : "Configure OAuth ou META_ACCESS_TOKEN.",
    insights,
    adAccounts: accounts
  });
});
