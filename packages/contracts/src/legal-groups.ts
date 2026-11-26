import type { LegalContract } from "./legal.js";

/** A group needs at least this many contracts with the same key. */
export const LEGAL_GROUP_MIN = 3;

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The title without what is specific to one party: trailing "(...)" notes, and a trailing
 * " - <counterparty>" part. "Warrant (Ada Fund) (warrant)" becomes "Warrant".
 */
export function legalGroupName(contract: Pick<LegalContract, "title" | "counterparties">): string {
  let title = contract.title.trim();
  let before = "";
  while (before !== title) {
    before = title;
    title = title.replace(/\s*\([^()]*\)\s*$/, "").trim();
  }
  const cut = title.lastIndexOf(" - ");
  if (cut > 0) {
    const tail = norm(title.slice(cut + 3));
    if (contract.counterparties.some((party) => norm(party) === tail)) title = title.slice(0, cut);
  }
  return title || contract.title.trim();
}

/** Same contract type, same title once party-specific parts are removed, same term dates. */
export function legalGroupKey(contract: LegalContract): string {
  return [
    norm(contract.contractType),
    norm(legalGroupName(contract)),
    contract.effectiveDate ?? "",
    contract.expirationDate ?? "",
  ].join("|");
}

export type LegalContractRow =
  | { kind: "single"; contract: LegalContract }
  | { kind: "group"; key: string; name: string; contracts: LegalContract[] };

/**
 * Collapses contracts that share a group key into one row, placed where the first member was, so
 * the input order (the sort) is kept. Fewer than LEGAL_GROUP_MIN contracts stay single rows.
 */
export function groupLegalContracts(contracts: LegalContract[]): LegalContractRow[] {
  const byKey = new Map<string, LegalContract[]>();
  for (const contract of contracts) {
    const key = legalGroupKey(contract);
    byKey.set(key, [...(byKey.get(key) ?? []), contract]);
  }
  const rows: LegalContractRow[] = [];
  const done = new Set<string>();
  for (const contract of contracts) {
    const key = legalGroupKey(contract);
    const members = byKey.get(key) ?? [];
    if (members.length < LEGAL_GROUP_MIN) {
      rows.push({ kind: "single", contract });
    } else if (!done.has(key)) {
      done.add(key);
      rows.push({ kind: "group", key, name: legalGroupName(contract), contracts: members });
    }
  }
  return rows;
}
