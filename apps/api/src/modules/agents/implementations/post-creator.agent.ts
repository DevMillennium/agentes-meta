import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { prisma } from "../../../common/prisma";
import { generateChatCompletion } from "../../ai/openai.service";
import { MetaApiService } from "../../meta/services/meta-api.service";
import { AgentBase } from "../base/agent.base";

const metaApi = new MetaApiService();
const DEFAULT_IG_IMAGE =
  "https://images.unsplash.com/photo-1611186873808-90c0c1b2e1a1?w=1080&q=80";

export class PostCreatorAgent extends AgentBase<
  Record<string, unknown>,
  { caption: string; hashtags: string[]; imageUrl: string },
  { caption: string; publishedId?: string }
> {
  public readonly name = "PostCreatorAgent";
  public readonly riskProfile = "low" as const;

  public async analyze(
    input: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentDecision<{ caption: string; hashtags: string[]; imageUrl: string }>> {
    const productId = String(input.productId ?? "");
    const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;

    const caption = await generateChatCompletion(
      [
        {
          role: "system",
          content:
            "Crie legenda Instagram para Phoenix Global Imports (eletrônicos). 2 parágrafos curtos + 5 hashtags no final. pt-BR."
        },
        {
          role: "user",
          content: `Tema: ${String(input.objective ?? "promoção semanal")}. Produto: ${product?.name ?? "linha Apple/Samsung"}.`
        }
      ],
      { maxTokens: 400 }
    );

    const hashtags = ["#PhoenixGlobal", "#Fortaleza", "#Eletronicos", "#Apple", "#Promocao"];
    const imageUrl = product?.imageUrls?.[0] ?? DEFAULT_IG_IMAGE;
    this.log("generate_post", context);

    return {
      agentName: this.name,
      actionType: "generate_content_posts",
      riskLevel: "low",
      reason: "Legenda gerada para publicação.",
      payload: { caption, hashtags, imageUrl },
      requiresApproval: false
    };
  }

  public async execute(
    decision: AgentDecision<{ caption: string; hashtags: string[]; imageUrl: string }>,
    context: AgentContext
  ): Promise<AgentExecutionResult<{ caption: string; publishedId?: string }>> {
    const fullCaption = `${decision.payload.caption}\n\n${decision.payload.hashtags.join(" ")}`;
    const publish = await metaApi.publishInstagramPost({
      caption: fullCaption,
      imageUrl: decision.payload.imageUrl
    });

    this.log("publish_instagram", context, { ok: publish.ok });

    if (publish.ok && publish.data?.id) {
      return {
        success: true,
        message: "Post publicado no Instagram.",
        data: { caption: fullCaption, publishedId: publish.data.id }
      };
    }

    return {
      success: true,
      message: publish.note ?? publish.error ?? "Legenda pronta; publicação IG pendente de token/permisões.",
      data: { caption: fullCaption }
    };
  }
}
