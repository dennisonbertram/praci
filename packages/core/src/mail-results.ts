// Pure format and search logic for saved mail search results. No I/O, no vendor SDK.
// The row type is structural so this module does not depend on the mail provider package.

// ponytail: fixed budget; switch to the model's context window if small-context models truncate too often.
// Under the 12,000 characters past which the pi runtime shortens a tool result (serializeToolResult),
// so the model reads every row whole; above it the overview lost its senders and subjects.
export const MAIL_GREP_BUDGET = 11_500;

const FIELD_MAX = 500;
const PREVIEW_MAX = 700;
const MAX_PATTERNS = 20;
const MAX_PATTERN_LENGTH = 200;
const TRUNCATED_NOTE = "truncated - refine patterns, dates, or maxResults";

export type MailResultSource = {
  account: string;
  id: string;
  threadId: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
};

export type MailResultRow = { line: number; date: string; text: string };

export type MailQueryOutcome = {
  account: string;
  q: string;
  complete: boolean;
  hasMore: boolean;
  stoppedReason?: "cap" | "deadline" | "error";
  oldest?: string | null;
};

export type MailSearchSummary = {
  records: number;
  dateRange: { oldest: string | null; newest: string | null };
  byYear: Record<string, number>;
  accounts: string[];
  perQuery: Omit<MailQueryOutcome, "oldest">[];
  coverage: "complete" | "capped";
  coveredBackTo?: string;
  failedAccounts?: string[];
  firstRecords: string[];
  lastRecords: string[];
};

export type MailGrepOptions = {
  searchId: string;
  patterns?: readonly unknown[];
  dateFrom?: string;
  dateTo?: string;
  maxResults?: unknown;
  contextLines?: unknown;
  afterLine?: unknown;
};

export type MailGrepResult = {
  searchId: string;
  totalMatches: number;
  shown: number;
  matches: { line: number; text: string }[];
  note?: string;
};

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function field(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, FIELD_MAX);
}

export function resultRow(source: MailResultSource, line: number): MailResultRow {
  const date = field(source.date);
  const text = [
    String(line).padStart(4, "0"),
    date,
    `acct:${field(source.account)}`,
    `id:${field(source.id)}`,
    `thread:${field(source.threadId)}`,
    `from:${field(source.from)}`,
    `to:${field(source.to)}`,
    `subject:${field(source.subject)}`,
    `snip:${field(source.snippet)}`,
  ].join(" | ");
  return { line, date, text };
}

export function coverage(queries: readonly MailQueryOutcome[]): {
  coverage: "complete" | "capped";
  coveredBackTo?: string;
} {
  const stopped = queries.filter((query) => !query.complete);
  if (stopped.length === 0) return { coverage: "complete" };
  const dates = stopped.flatMap((query) => (query.oldest ? [query.oldest] : []));
  const coveredBackTo = dates.sort()[0];
  return coveredBackTo ? { coverage: "capped", coveredBackTo } : { coverage: "capped" };
}

export function summarizeResults(input: {
  rows: readonly MailResultRow[];
  accounts: readonly string[];
  queries: readonly MailQueryOutcome[];
  failedAccounts?: readonly string[];
}): MailSearchSummary {
  const { rows } = input;
  const byYear: Record<string, number> = {};
  for (const row of rows) {
    const year = row.date.slice(0, 4);
    byYear[year] = (byYear[year] ?? 0) + 1;
  }
  const preview = (list: readonly MailResultRow[]) =>
    list.map((row) => row.text.slice(0, PREVIEW_MAX));
  return {
    records: rows.length,
    dateRange: { oldest: rows[0]?.date ?? null, newest: rows[rows.length - 1]?.date ?? null },
    byYear,
    accounts: [...input.accounts],
    perQuery: input.queries.map(({ oldest: _oldest, ...query }) => query),
    ...coverage(input.queries),
    ...(input.failedAccounts?.length ? { failedAccounts: [...input.failedAccounts] } : {}),
    firstRecords: preview(rows.slice(0, 3)),
    // Start after the first 3 so a short result does not list the same rows twice.
    lastRecords: preview(rows.slice(Math.max(3, rows.length - 3))),
  };
}

// Quantifiers outside a character class and backreferences are what make a regex
// exponential, so a pattern containing either is matched as plain text instead.
export function isSafeRegexPattern(pattern: string): boolean {
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charAt(i);
    if (char === "\\") {
      if (/[1-9k]/.test(pattern.charAt(i + 1))) return false;
      i++;
    } else if (inClass) {
      inClass = char !== "]";
    } else if (char === "[") {
      inClass = true;
    } else if ("*+?{}".includes(char)) {
      return false;
    }
  }
  return true;
}

export function normalizePatterns(patterns: readonly unknown[] | undefined): string[] {
  return (patterns ?? [])
    .filter((p): p is string => typeof p === "string" && p !== "")
    .slice(0, MAX_PATTERNS)
    .map((p) => p.slice(0, MAX_PATTERN_LENGTH));
}

const REGEX_SYNTAX = /[\\^$.|()[\]*+?{}]/;

// `literal` is true when the pattern matches as a plain case-insensitive substring.
function compilePattern(pattern: string): { re: RegExp; literal: boolean } {
  if (isSafeRegexPattern(pattern)) {
    try {
      return { re: new RegExp(pattern, "iu"), literal: !REGEX_SYNTAX.test(pattern) };
    } catch {
      // Invalid regex: fall through to a literal match.
    }
  }
  return { re: new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu"), literal: true };
}

/** True when Postgres may narrow rows with `ILIKE` on the normalized patterns before the exact match. */
export function isLiteralOnly(patterns: readonly unknown[] | undefined): boolean {
  const list = normalizePatterns(patterns);
  return list.length > 0 && list.every((pattern) => compilePattern(pattern).literal);
}

export function budgetJson(
  result: Omit<MailGrepResult, "note">,
  limit: number = MAIL_GREP_BUDGET,
): MailGrepResult {
  const build = (matches: MailGrepResult["matches"]): MailGrepResult => ({
    ...result,
    shown: matches.length,
    matches,
    ...(matches.length < result.totalMatches ? { note: TRUNCATED_NOTE } : {}),
  });
  let matches = result.matches;
  while (matches.length > 0 && JSON.stringify(build(matches)).length > limit) {
    matches = matches.slice(0, -1);
  }
  return build(matches);
}

/**
 * Matches rows in batches: call `add` for each batch in line order, then `finish` with the
 * context rows for `matchedLines()`. Keeps only the first `maxResults` matches in memory.
 */
export function createGrepScan(options: MailGrepOptions) {
  const matchers = normalizePatterns(options.patterns).map((pattern) => compilePattern(pattern).re);
  const maxResults = clampInt(options.maxResults, 1, 200, 50);
  const contextLines = clampInt(options.contextLines, 0, 5, 0);
  const afterLine = clampInt(options.afterLine, 0, Number.MAX_SAFE_INTEGER, 0);
  const { dateFrom, dateTo } = options;
  const kept: MailResultRow[] = [];
  let totalMatches = 0;

  return {
    contextLines,
    add(batch: readonly MailResultRow[]): void {
      for (const row of batch) {
        if (row.line <= afterLine) continue;
        if (dateFrom && row.date < dateFrom) continue;
        if (dateTo && row.date.slice(0, dateTo.length) > dateTo) continue;
        if (matchers.length > 0 && !matchers.some((re) => re.test(row.text))) continue;
        totalMatches += 1;
        if (kept.length < maxResults) kept.push(row);
      }
    },
    matchedLines: (): number[] => kept.map((row) => row.line),
    finish(contextRows: readonly MailResultRow[] = []): MailGrepResult {
      const byLine = new Map(contextRows.map((row) => [row.line, row] as const));
      const matches = kept.map((row) => {
        byLine.set(row.line, row);
        const block: string[] = [];
        for (let line = row.line - contextLines; line <= row.line + contextLines; line++) {
          const text = byLine.get(line)?.text;
          if (text !== undefined) block.push(text.slice(0, FIELD_MAX));
        }
        return { line: row.line, text: block.join("\n") };
      });
      return budgetJson({
        searchId: options.searchId,
        totalMatches,
        shown: matches.length,
        matches,
      });
    },
  };
}

/** One-pass grep over rows in memory. Context comes from `contextRows`, which defaults to `rows`. */
export function grepRows(
  rows: readonly MailResultRow[],
  options: MailGrepOptions,
  contextRows: readonly MailResultRow[] = rows,
): MailGrepResult {
  const scan = createGrepScan(options);
  scan.add(rows);
  return scan.finish(contextRows);
}

const QUOTE_MARKERS = [
  /^[ \t>]*On\s[\s\S]{0,300}?wrote:/m,
  /^[ \t>-]*Forwarded message/im,
  /^[ \t>]*From:[^\n]*\r?\n[ \t>]*(?:Sent|Date):/im,
];

/** Drops the quoted reply or forwarded text. A body that is entirely quoted is returned unchanged. */
export function stripQuotedReply(body: string): string {
  const cut = Math.min(
    body.length,
    ...QUOTE_MARKERS.map((marker) => body.search(marker)).filter((index) => index >= 0),
  );
  return body.slice(0, cut).trim() || body;
}
