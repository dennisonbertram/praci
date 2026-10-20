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

// Runway figures the Finance page also hides: "9.2 months of runway", "runs out around July 23, 2027".
// "the last 3 months" names the window burn is averaged over, not a runway figure, so it stays.
const MONTHS = String.raw`(?<!\b(?:last|past|previous)\s)\d+(?:[.,]\d+)?(?=\s?(?:months?|mos?)\b)`;
const MONTH_NAME = String.raw`(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?`;
const DATE = new RegExp(
  String.raw`\b(?:${MONTH_NAME}\s\d{1,2}(?:st|nd|rd|th)?(?:,?\s\d{4})?|${MONTH_NAME}\s\d{4}|\d{4}-\d{2}-\d{2})\b`,
  "gi",
);
const RUNWAY = /\brunway\b/i;
const RUN_OUT = /\bruns?[\s-]?out\b|\bout of (?:cash|money)\b|\bzero cash\b/i;

/** True when a table label (a header or a row's first cell) names runway or the run-out date. */
export const isRunwayLabel = (label: string) => RUNWAY.test(label) || RUN_OUT.test(label);

/** Masks every month count, date, or bare number in a table cell whose label says runway. */
export function maskRunwayCell(text: string): string {
  if (/^\s*\d+(?:[.,]\d+)?\s*$/.test(text)) return "•••";
  return text.replace(new RegExp(MONTHS, "gi"), "•••").replace(DATE, "•••");
}

/** The sentence (or line) around `index`; a decimal point such as 9.2 does not end one. */
function sentenceAround(text: string, index: number): string {
  const boundary = /[.!?](?=\s|$)|\n/g;
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(boundary)) {
    const at = m.index ?? 0;
    if (at < index) start = at + 1;
    else {
      end = at;
      break;
    }
  }
  return text.slice(start, end);
}

/** Runway months and run-out dates, masked like amounts, only in a sentence about runway. */
function runwayMatches(text: string): CurrencyMatch[] {
  const out: CurrencyMatch[] = [];
  for (const m of text.matchAll(new RegExp(MONTHS, "gi"))) {
    const start = m.index ?? 0;
    if (RUNWAY.test(sentenceAround(text, start)))
      out.push({ start, end: start + m[0].length, replacement: "•••" });
  }
  for (const m of text.matchAll(DATE)) {
    const start = m.index ?? 0;
    if (RUN_OUT.test(sentenceAround(text, start)))
      out.push({ start, end: start + m[0].length, replacement: "•••" });
  }
  return out;
}

/**
 * Where amounts sit in `text`, each with its mask: currency keeps its symbol and sign (`$•••`), a
 * percentage keeps its sign (`•••%`), and a count written with thousands groups becomes `•••`.
 * Also runway months and run-out dates in sentences about runway. Sorted and non-overlapping.
 */
export function currencyMatches(text: string): CurrencyMatch[] {
  const all = [...moneyMatches(text), ...runwayMatches(text)].sort((a, b) => a.start - b.start);
  const out: CurrencyMatch[] = [];
  for (const m of all) if (!out.length || m.start >= (out.at(-1) as CurrencyMatch).end) out.push(m);
  return out;
}

function moneyMatches(text: string): CurrencyMatch[] {
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
 * Replaces each currency amount, percentage, grouped count and runway figure with a fixed mask.
 * Small plain numbers, years and dates stay.
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

/** While amounts are hidden, every figure in a pin is masked and its unit kept: "$•••", "••• mo". */
export const maskPinFigures = (text: string) => text.replace(/\d(?:[\d,.\s]*\d)?/g, "•••");
