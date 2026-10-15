const LEGAL_SUFFIXES = new Set([
  "inc",
  "llc",
  "llp",
  "lp",
  "ltd",
  "plc",
  "corp",
  "corporation",
  "co",
  "company",
]);

/**
 * The grouping key for a counterparty: lowercase words joined by hyphens, with trailing legal
 * suffixes dropped and anything after a `*` or `#` (card-processor references) cut off.
 * "Brex Inc." and "BREX" are both "brex". Never empty.
 */
export function vendorKey(counterparty: string): string {
  const head = counterparty.toLowerCase().split(/[*#]/)[0] ?? "";
  const words = head.match(/[a-z0-9]+/g) ?? [];
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1] ?? "")) words.pop();
  return words.join("-") || "unknown";
}

/** URL slug for a provider category ("Credit & Loan Payments" is "credit-loan-payments"); "uncategorized" for none. */
export function categorySlug(category: string | null | undefined): string {
  return (category?.toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-") || "uncategorized";
}
