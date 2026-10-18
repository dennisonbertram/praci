const SC = String.raw`\p{Sc}`;
const CODES = "(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|INR|CNY|MXN|BRL|SEK|NOK|DKK|NZD|SGD|HKD)";
// 1,234.56  1.234,56  1 234,56  1234  (space, nbsp, comma or dot group separators)
const NUM = String.raw`(?:\d{1,3}(?:[ ,.  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;
const SCALE = String.raw`(?:\s?(?:million|billion|thousand)\b|[kKmMbB](?![\p{L}\p{N}_]))`;
const SIGN = "[-−+]?";
const WORD = String.raw`[\p{L}\p{N}_]`;
// 600,000  4.000.000  1 234 567 (comma, dot, nbsp or narrow nbsp groups; plain spaces are too ambiguous)
const GROUPED = String.raw`\d{1,3}(?:[,.\u00a0\u202f]\d{3})+`;

const CURRENCY = new RegExp(
  [
    // $73,781.83  -$300  $-1,234.56  €1.234,56  ₹450k  $2 million
    String.raw`(?<s1>${SIGN})(?<y1>${SC})\s?${SIGN}${NUM}${SCALE}?`,
    // USD 1,200  usd1.5M  EUR -50  (not inside a word, as in invoiceUSD1234.pdf)
    String.raw`(?<![\p{L}\p{N}_])(?<s2>${SIGN})${CODES}\s?${SIGN}${NUM}${SCALE}?`,
    // 1,200 USD  1.234,56 EUR  1 234,56 €
    String.raw`(?<![\p{L}\p{N}_$.,])(?<s3>${SIGN})${NUM}${SCALE}?\s?(?:${CODES}(?!${WORD})|${SC}(?!\d))`,
    // Ownership figures: 40%  15.00 %  (a percentage is an amount on the Cap table and in Finance)
    String.raw`(?<![\p{L}\p{N}_$.,])(?<pc>${NUM})\s?%`,
    // Share and option counts: 600,000 options  4,000,000  (any number written with thousands groups)
    String.raw`(?<![\p{L}\p{N}_$.,/])(?<ct>${GROUPED})(?![\p{N}_]|[.,]\d)`,
  ].join("|"),
  "giu",
);

export type CurrencyMatch = { start: number; end: number; replacement: string };

/**
 * Where amounts sit in `text`, each with its mask: currency keeps its symbol and sign (`$•••`), a
 * percentage keeps its sign (`•••%`), and a count written with thousands groups becomes `•••`.
 */
export function currencyMatches(text: string): CurrencyMatch[] {
  const out: CurrencyMatch[] = [];
  for (const m of text.matchAll(CURRENCY)) {
    const g = m.groups ?? {};
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (g.pc !== undefined || g.ct !== undefined) {
      out.push({ start, end, replacement: g.pc !== undefined ? "•••%" : "•••" });
      continue;
    }
    const sign = g.s1 ?? g.s2 ?? g.s3 ?? "";
    out.push({ start, end, replacement: `${sign}${g.y1 ?? "$"}•••` });
  }
  return out;
}

/**
 * Replaces each currency amount, percentage and grouped count with a fixed mask. Small plain
 * numbers, years and dates stay.
 */
export function maskCurrencyText(text: string): string {
  let out = "";
  let at = 0;
  for (const m of currencyMatches(text)) {
    out += text.slice(at, m.start) + m.replacement;
    at = m.end;
  }
  return out + text.slice(at);
}
