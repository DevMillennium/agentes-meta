import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { prisma } from "../../../common/prisma";
import { generateJsonCompletion } from "../../ai/openai.service";
import { AgentBase } from "../base/agent.base";

interface CopyPayload {
  title: string;
  body: string;
  cta: string;
}

export class AdCopywriterAgent extends AgentBase<
  Record<string, unknown>,
  CopyPayload & { creativeId: string },
  CopyPayload
> {
  public readonly name = "AdCopywriterAgent";
  public readonly riskProfile = "low" as const;

  public async analyze(
    input: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentDecision<CopyPayload & { creativeId: string }>> {
    const productId = String(input.productId ?? "");
    const product = productId
      ? await prisma.product.findUnique({ where: { id: productId } })
      : null;

    const productDesc = product
      ? `${product.name} - R$ ${product.price} - ${product.description ?? "eletrônico premium"}`
      : "Produtos Phoenix Global (Apple, Samsung, Xiaomi)";

    const generated = await generateJsonCompletion<CopyPayload>(
      "Gere copy de anúncio Meta em pt-BR. JSON: { title, body, cta }. Sem claims proibidos. CTA para WhatsApp ou Saiba mais.",
      `Produto: ${productDesc}. Objetivo: ${String(input.objective ?? "vendas")}.`
    );

    const copy: CopyPayload = generated ?? {
      title: product?.name ?? "Phoenix Global Imports",
      body: "Eletrônicos originais com garantia e entrega rápida. Chame no WhatsApp!",
      cta: "WHATSAPP_MESSAGE"
    };

    const creative = await prisma.creative.create({
      data: {
        productId: product?.id,
        title: copy.title,
        body: copy.body,
        cta: copy.cta,
        createdByAgent: this.name
      }
    });

    this.log("generate_ad_copy", context, { creativeId: creative.id });

    return {
      agentName: this.name,
      actionType: "generate_ad_copy",
      riskLevel: "low",
      reason: "Copy e criativo salvos no banco.",
      payload: { ...copy, creativeId: creative.id },
      requiresApproval: false
    };
  }

  public async execute(
    decision: AgentDecision<CopyPayload & { creativeId: string }>,
    _context: AgentContext
  ): Promise<AgentExecutionResult<CopyPayload>> {
    return {
      success: true,
      message: "Copy gerada.",
      data: {
        title: decision.payload.title,
        body: decision.payload.body,
        cta: decision.payload.cta
      }
    };
  }
}
