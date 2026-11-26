import type { CompanyRelation } from "@rakazo/contracts";
import { t } from "./i18n";

export function companyRelationLabel(relation: CompanyRelation): string {
  switch (relation) {
    case "works_at":
      return t("works at");
    case "reports_to":
      return t("reports to");
    case "founded":
      return t("founded");
    case "invested_in":
      return t("invested in");
    case "customer_of":
      return t("customer of");
    case "vendor_of":
      return t("vendor of");
    case "counsel_for":
      return t("counsel for");
    case "party_to":
      return t("party to");
    case "works_on":
      return t("works on");
    case "part_of":
      return t("part of");
  }
}
