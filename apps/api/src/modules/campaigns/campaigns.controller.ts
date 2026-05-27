import { Router } from "express";
import { MetaApiService } from "../meta/services/meta-api.service";

export const campaignsRouter = Router();
const metaApi = new MetaApiService();

campaignsRouter.post("/diagnose", async (req, res) => {
  const insights = await metaApi.fetchAdsInsightsPlaceholder(req.body ?? {});
  res.json({
    diagnosis: "Diagnostico inicial gerado por placeholder.",
    insights
  });
});
