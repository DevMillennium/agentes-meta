import type { AgentContext, AgentDecision, AgentExecutionResult } from "@phoenix/shared";
import { prisma } from "../../../common/prisma";
import { AgentBase } from "../base/agent.base";

export class ProductManagerAgent extends AgentBase<
  Record<string, unknown>,
  { valid: boolean; product?: { id: string; name: string; stock: number } },
  { valid: boolean }
> {
  public readonly name = "ProductManagerAgent";
  public readonly riskProfile = "medium" as const;

  public async analyze(
    input: Record<string, unknown>,
    _context: AgentContext
  ): Promise<AgentDecision<{ valid: boolean; product?: { id: string; name: string; stock: number } }>> {
    const productId = String(input.productId ?? "");
    const product = productId
      ? await prisma.product.findUnique({ where: { id: productId } })
      : await prisma.product.findFirst({ where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });

    const valid = Boolean(product && product.stockQuantity > 0);

    return {
      agentName: this.name,
      actionType: "validate_product_stock",
      riskLevel: valid ? "low" : "medium",
      reason: valid
        ? `Produto ${product!.name} com estoque ${product!.stockQuantity}.`
        : "Produto indisponível ou sem estoque.",
      payload: valid
        ? { valid: true, product: { id: product!.id, name: product!.name, stock: product!.stockQuantity } }
        : { valid: false },
      requiresApproval: !valid
    };
  }

  public async execute(
    decision: AgentDecision<{ valid: boolean }>,
    _context: AgentContext
  ): Promise<AgentExecutionResult<{ valid: boolean }>> {
    return {
      success: decision.payload.valid,
      message: decision.reason,
      data: { valid: decision.payload.valid }
    };
  }
}
