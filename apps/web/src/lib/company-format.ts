import type { CompanyFact, CompanyPartialDate } from "@rakazo/contracts";

export function companyDate(value: CompanyPartialDate | null | undefined): string {
  if (!value) return "—";
  if (value.precision === "year") return value.date.slice(0, 4);
  if (value.precision === "quarter")
    return `${value.date.slice(0, 4)} Q${Math.ceil(Number(value.date.slice(5, 7)) / 3)}`;
  if (value.precision === "month") return value.date.slice(0, 7);
  return value.date;
}
export function companyFactTitle(fact: CompanyFact): string {
  if (fact.kind === "entity") return fact.record.displayName;
  if (fact.kind === "event") return fact.record.title;
  return fact.record.role ?? fact.record.relation.replaceAll("_", " ");
}
