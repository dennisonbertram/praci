// Pure format and search logic for saved mail search results. No I/O, no vendor SDK.
// The row type is structural so this module does not depend on the mail provider package.

export const MAIL_GREP_BUDGET = 16_000;

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
  return fallback;
}

export function resultRow(source: MailResultSource, line: number): MailResultRow {
  return { line, date: "", text: "" };
}

export function coverage(queries: readonly MailQueryOutcome[]): {
  coverage: "complete" | "capped";
  coveredBackTo?: string;
} {
  return { coverage: "complete" };
}

export function summarizeResults(input: {
  rows: readonly MailResultRow[];
  accounts: readonly string[];
  queries: readonly MailQueryOutcome[];
  failedAccounts?: readonly string[];
}): MailSearchSummary {
  return {
    records: 0,
    dateRange: { oldest: "", newest: "" },
    byYear: {},
    accounts: [],
    perQuery: [],
    coverage: "complete",
    firstRecords: [],
    lastRecords: [],
  };
}

export function isSafeRegexPattern(pattern: string): boolean {
  return true;
}

export function normalizePatterns(patterns: readonly unknown[] | undefined): string[] {
  return [];
}

export function isLiteralOnly(patterns: readonly unknown[] | undefined): boolean {
  return false;
}

export function budgetJson(
  result: Omit<MailGrepResult, "note">,
  limit: number = MAIL_GREP_BUDGET,
): MailGrepResult {
  return result;
}

export function createGrepScan(options: MailGrepOptions): {
  add(batch: readonly MailResultRow[]): void;
  matchedLines(): number[];
  contextLines: number;
  finish(contextRows?: readonly MailResultRow[]): MailGrepResult;
} {
  return {
    add() {},
    matchedLines: () => [],
    contextLines: 0,
    finish: () => ({ searchId: options.searchId, totalMatches: 0, shown: 0, matches: [] }),
  };
}

export function grepRows(
  rows: readonly MailResultRow[],
  options: MailGrepOptions,
  contextRows: readonly MailResultRow[] = rows,
): MailGrepResult {
  return { searchId: options.searchId, totalMatches: 0, shown: 0, matches: [] };
}

export function stripQuotedReply(body: string): string {
  return body;
}
