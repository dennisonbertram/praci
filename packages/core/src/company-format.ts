import type { CompanyFact, CompanyPartialDate, CompanyRelation } from "@rakazo/contracts";

export function companyDate(value: CompanyPartialDate | null | undefined): string {
  if (!value) return "—";
  if (value.precision === "year") return value.date.slice(0, 4);
  if (value.precision === "quarter")
    return `${value.date.slice(0, 4)} Q${Math.ceil(Number(value.date.slice(5, 7)) / 3)}`;
  if (value.precision === "month") return value.date.slice(0, 7);
  return value.date;
}
export function companyDateEnd(value: CompanyPartialDate): string {
  const end = new Date(`${value.date}T00:00:00.000Z`);
  if (value.precision === "year") end.setUTCFullYear(end.getUTCFullYear() + 1, 0, 0);
  if (value.precision === "quarter") end.setUTCMonth(Math.ceil((end.getUTCMonth() + 1) / 3) * 3, 0);
  if (value.precision === "month") end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
}
export function companyFactTitle(
  fact: CompanyFact,
  nameOf?: (id: string) => string | undefined,
  relationLabel: (relation: CompanyRelation) => string = (relation) =>
    relation.replaceAll("_", " "),
): string {
  if (fact.kind === "entity") return fact.record.displayName;
  if (fact.kind === "event") return fact.record.title;
  const label = fact.record.role ?? relationLabel(fact.record.relation);
  if (!nameOf) return label;
  return [nameOf(fact.record.fromId), label, nameOf(fact.record.toId)].filter(Boolean).join(" · ");
}
