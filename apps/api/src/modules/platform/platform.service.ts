import { getEffectiveMetaIds } from "../../config/meta-runtime";
import { getMetaAccessToken, isMetaOAuthConfigured } from "../../config/env";
import { loadUserMetaToken } from "../../config/meta-token.service";
import { prisma } from "../../common/prisma";
import { AGENT_CATALOG } from "../agents/services/agent-catalog";

export async function buildPlatformOverview(userId?: string) {
  const token = userId ? await loadUserMetaToken(userId) : null;
  const ids = getEffectiveMetaIds();

  const [leads, conversations, messages, pendingApprovals, campaigns, products, creatives, recentActions] =
    await Promise.all([
      prisma.lead.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.approvalRequest.count({ where: { status: "PENDING" } }),
      prisma.campaign.count(),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.creative.count(),
      prisma.agentAction.findMany({ orderBy: { createdAt: "desc" }, take: 15 })
    ]);

  return {
    service: "phoenix-platform-api",
    timestamp: new Date().toISOString(),
    stats: {
      leads,
      conversations,
      messages,
      pendingApprovals,
      campaigns,
      activeProducts: products,
      creatives
    },
    agents: {
      total: AGENT_CATALOG.length,
      catalog: AGENT_CATALOG
    },
    meta: {
      oauthConfigured: isMetaOAuthConfigured(),
      hasAccessToken: Boolean(getMetaAccessToken()),
      tokenObtainedAt: token?.obtainedAt ?? null,
      tokenExpiresAt: token?.expiresAt ?? null,
      whatsappReady: Boolean(getMetaAccessToken() && ids.whatsappPhoneNumberId),
      instagramReady: Boolean(getMetaAccessToken() && ids.instagramBusinessAccountId),
      marketingReady: Boolean(getMetaAccessToken()),
      adAccountId: ids.adAccountId ?? null,
      pageId: ids.pageId ?? null,
      instagramBusinessAccountId: ids.instagramBusinessAccountId ?? null,
      whatsappPhoneNumberId: ids.whatsappPhoneNumberId ?? null,
      assetsSyncedAt: ids.assetsSyncedAt
    },
    recentActions
  };
}
