import type { CompanyEdgeRecord } from "@rakazo/contracts";

/** The relationship label for the organisation's side of an edge with the company. */
export function companyRelationKind(
  edge: CompanyEdgeRecord,
  profileId: string,
): "supplier" | "customer" | "investor" | "lawFirm" | null {
  if (edge.fromId !== profileId && edge.toId !== profileId) return null;
  const orgIsFrom = edge.toId === profileId;
  switch (edge.relation) {
    case "vendor_of":
      return orgIsFrom ? "supplier" : "customer";
    case "customer_of":
      return orgIsFrom ? "customer" : "supplier";
    case "invested_in":
      return orgIsFrom ? "investor" : null;
    case "counsel_for":
      return orgIsFrom ? "lawFirm" : null;
    default:
      return null;
  }
}
