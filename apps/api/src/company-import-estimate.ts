import type { CompanyImportPlan } from "@rakazo/contracts";

/** A sample-based heuristic, not a provider/tokenizer guarantee. Unknown totals stay cap-bounded. */
export function companyImportEstimate(
  itemCount: number | null,
  tokenCap: number,
  sample?: { itemsRead: number; tokensUsed: number },
): CompanyImportPlan {
  if (itemCount !== null && sample && sample.itemsRead > 0 && sample.tokensUsed > 0) {
    const projected = (sample.tokensUsed / sample.itemsRead) * itemCount;
    return {
      itemCount,
      tokensLower: Math.min(Number.MAX_SAFE_INTEGER, Math.floor(projected / 2)),
      tokensUpper: Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(projected * 2)),
      estimateBasis: "sample",
    };
  }
  return { itemCount, tokensLower: 0, tokensUpper: tokenCap, estimateBasis: "budget_cap" };
}
