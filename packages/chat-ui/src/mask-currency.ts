const SC = String.raw`\p{Sc}`;
const CODES = "(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|INR|CNY|MXN|BRL|SEK|NOK|DKK|NZD|SGD|HKD)";
// 1,234.56  1.234,56  1 234,56  1234  (space, nbsp, comma or dot group separators)
const NUM = String.raw`(?:\d{1,3}(?:[ ,.  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;
const SCALE = String.raw`(?:\s?(?:million|billion|thousand)\b|[kKmMbB](?![\p{L}\p{N}_]))`;
const SIGN = "[-−+]?";
const WORD = String.raw`[\p{L}\p{N}_]`;

const CURRENCY = new RegExp(
  [
    // $73,781.83  -$300  $-1,234.56  €1.234,56  ₹450k  $2 million
    String.raw`(?<s1>${SIGN})(?<y1>${SC})\s?${SIGN}${NUM}${SCALE}?`,
    // USD 1,200  usd1.5M  EUR -50  (not inside a word, as in invoiceUSD1234.pdf)
    String.raw`(?<![\p{L}\p{N}_])(?<s2>${SIGN})${CODES}\s?${SIGN}${NUM}${SCALE}?`,
    // 1,200 USD  1.234,56 EUR  1 234,56 €
    String.raw`(?<![\p{L}\p{N}_$.,])(?<s3>${SIGN})${NUM}${SCALE}?\s?(?:${CODES}(?!${WORD})|${SC}(?!\d))`,
  ].join("|"),
  "giu",
);

export type CurrencyMatch = { start: number; end: number; replacement: string };

/** Where currency amounts sit in `text`, each with its mask (`$•••`, keeping the symbol and sign). */
export function currencyMatches(text: string): CurrencyMatch[] {
  const out: CurrencyMatch[] = [];
  for (const m of text.matchAll(CURRENCY)) {
    const g = m.groups ?? {};
    const sign = g.s1 ?? g.s2 ?? g.s3 ?? "";
    out.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      replacement: `${sign}${g.y1 ?? "$"}•••`,
    });
  }
  return out;
}

/** Replaces each currency amount with a fixed mask. Plain numbers, dates and counts stay. */
export function maskCurrencyText(text: string): string {
  let out = "";
  let at = 0;
  for (const m of currencyMatches(text)) {
    out += text.slice(at, m.start) + m.replacement;
    at = m.end;
  }
  return out + text.slice(at);
}
