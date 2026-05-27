import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { CampaignStatus } from "@prisma/client";
import { getEffectiveMetaIds } from "../../../config/meta-runtime";
import { prisma } from "../../../common/prisma";
import { MetaApiService } from "../../meta/services/meta-api.service";
import { AgentBase } from "../base/agent.base";

const metaApi = new MetaApiService();

export class PaidTrafficStrategistAgent extends AgentBase<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
> {
  public readonly name = "PaidTrafficStrategistAgent";
  public readonly riskProfile = "high" as const;

  public async analyze(
    input: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentDecision<Record<string, unknown>>> {
    const budget = Number(input.maxDailyBudget ?? 50);
    const requiresApproval = budget > 100;

    return {
      agentName: this.name,
      actionType: "create_campaign_structure",
      riskLevel: requiresApproval ? "high" : "medium",
      reason: requiresApproval
        ? `Orçamento diário R$ ${budget} exige aprovação humana.`
        : "Estrutura de campanha pronta para criação.",
      payload: input,
      requiresApproval
    };
  }

  public async execute(
    decision: AgentDecision<Record<string, unknown>>,
    context: AgentContext
  ): Promise<AgentExecutionResult<Record<string, unknown>>> {
    const productId = String(decision.payload.productId ?? "");
    const ids = getEffectiveMetaIds();
    const adAccountId = ids.adAccountId ?? "";
    const campaignName = `Phoenix ${String(decision.payload.objective ?? "Campanha")} ${new Date().toISOString().slice(0, 10)}`;
    const dailyBudget = Number(decision.payload.maxDailyBudget ?? 50);

    let metaCampaignId: string | undefined;
    let metaAdSetId: string | undefined;
    let metaAdCreativeId: string | undefined;
    let metaAdId: string | undefined;

    const creativeDbId = String(decision.payload.creativeId ?? "");
    const creativeRow = creativeDbId
      ? await prisma.creative.findUnique({ where: { id: creativeDbId }, include: { product: true } })
      : null;

    if (metaApi.hasAccessToken() && adAccountId) {
      const objective =
        decision.payload.campaignType === "messages" ? "OUTCOME_ENGAGEMENT" : "OUTCOME_TRAFFIC";
      const campaignResult = await metaApi.createCampaign({
        adAccountId,
        name: campaignName,
        objective,
        status: "PAUSED"
      });
      if (campaignResult.ok && campaignResult.data && typeof campaignResult.data.id === "string") {
        metaCampaignId = campaignResult.data.id;
      }

      if (creativeRow && metaCampaignId) {
        const creativeResult = await metaApi.createAdCreative({
          adAccountId,
          name: `${campaignName} Creative`,
          title: creativeRow.title,
          body: creativeRow.body,
          imageUrl: creativeRow.mediaUrl ?? creativeRow.product?.imageUrls?.[0]
        });
        if (
          creativeResult.ok &&
          creativeResult.data &&
          typeof creativeResult.data.id === "string"
        ) {
          metaAdCreativeId = creativeResult.data.id;

          const adSetResult = await metaApi.createAdSet({
            adAccountId,
            campaignId: metaCampaignId,
            name: `${campaignName} AdSet`,
            dailyBudget,
            status: "PAUSED"
          });
          if (adSetResult.ok && adSetResult.data && typeof adSetResult.data.id === "string") {
            metaAdSetId = adSetResult.data.id;

            const adResult = await metaApi.createAd({
              adAccountId,
              adSetId: metaAdSetId,
              creativeId: metaAdCreativeId,
              name: `${campaignName} Ad`,
              status: "PAUSED"
            });
            if (adResult.ok && adResult.data && typeof adResult.data.id === "string") {
              metaAdId = adResult.data.id;
            }
          }
        }
      }
    }

    const normalizedActId = adAccountId
      ? adAccountId.startsWith("act_")
        ? adAccountId
        : `act_${adAccountId}`
      : "act_local_phoenix";

    let metaAdAccount = await prisma.metaAdAccount.findFirst({
      where: { accountId: normalizedActId }
    });

    if (!metaAdAccount) {
      let business = await prisma.businessAccount.findFirst();
      if (!business) {
        business = await prisma.businessAccount.create({
          data: { name: "Phoenix Global Imports", currency: "BRL", timezone: "America/Fortaleza" }
        });
      }
      metaAdAccount = await prisma.metaAdAccount.upsert({
        where: { accountId: normalizedActId },
        create: {
          businessAccountId: business.id,
          accountId: normalizedActId,
          name: "Conta Meta Phoenix"
        },
        update: { name: "Conta Meta Phoenix" }
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        metaAdAccountId: metaAdAccount.id,
        name: campaignName,
        objective: String(decision.payload.campaignType ?? "messages"),
        status: CampaignStatus.PAUSED,
        dailyBudget
      }
    });

    if (creativeDbId) {
      const adSet = await prisma.adSet.create({
        data: {
          campaignId: campaign.id,
          name: `${campaignName} - AdSet 1`,
          status: CampaignStatus.PAUSED,
          targetingJson: { geo_locations: { countries: ["BR"] }, age_min: 18, age_max: 55 }
        }
      });

      await prisma.ad.create({
        data: {
          adSetId: adSet.id,
          creativeId: creativeDbId,
          name: `${campaignName} - Ad 1`,
          status: CampaignStatus.PAUSED
        }
      });
    }

    this.log("create_campaign_structure", context, {
      campaignId: campaign.id,
      metaCampaignId,
      metaAdSetId,
      metaAdCreativeId,
      metaAdId
    });

    return {
      success: true,
      message: metaCampaignId
        ? "Campanha + criativo + ad set + ad criados na Meta (PAUSED) e no Postgres."
        : "Campanha criada no Postgres. Conecte Meta OAuth e rode POST /api/meta/sync-assets.",
      data: {
        campaignId: campaign.id,
        metaCampaignId,
        metaAdSetId,
        metaAdCreativeId,
        metaAdId,
        productId
      }
    };
  }
}
