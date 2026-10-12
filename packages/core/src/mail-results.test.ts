import { describe, expect, it } from "vitest";
import * as core from "./index.js";
import type { MailQueryOutcome, MailResultRow, MailResultSource } from "./mail-results.js";
import {
  budgetJson,
  clampInt,
  coverage,
  createGrepScan,
  grepRows,
  isLiteralOnly,
  isSafeRegexPattern,
  normalizePatterns,
  resultRow,
  stripQuotedReply,
  summarizeResults,
} from "./mail-results.js";

function source(over: Partial<MailResultSource> = {}): MailResultSource {
  return {
    account: "me@example.com",
    id: "m1",
    threadId: "t1",
    date: "2019-03-02T08:00:00.000Z",
    from: "Jana <jana@example.com>",
    to: "Me <me@example.com>",
    subject: "First hello",
    snippet: "Hi there",
    ...over,
  };
}

function row(line: number, over: Partial<MailResultSource> = {}): MailResultRow {
  return resultRow(source({ id: `m${line}`, threadId: `t${line}`, ...over }), line);
}

function rowsWithSubjects(subjects: string[]): MailResultRow[] {
  return subjects.map((subject, i) => row(i + 1, { subject }));
}

function lines(result: { matches: { line: number }[] }): number[] {
  return result.matches.map((m) => m.line);
}

describe("resultRow", () => {
  it("formats a pipe-delimited row with a 4-digit padded 1-based line", () => {
    expect(resultRow(source(), 1)).toEqual({
      line: 1,
      date: "2019-03-02T08:00:00.000Z",
      text: "0001 | 2019-03-02T08:00:00.000Z | acct:me@example.com | id:m1 | thread:t1 | from:Jana <jana@example.com> | to:Me <me@example.com> | subject:First hello | snip:Hi there",
    });
    expect(resultRow(source(), 4321).text.startsWith("4321 | ")).toBe(true);
    expect(resultRow(source(), 12).text.startsWith("0012 | ")).toBe(true);
  });

  it("collapses whitespace so mail text cannot fake another row", () => {
    const { text } = resultRow(
      source({ subject: "Line one\n  line   two", snippet: "a\r\n0002 | fake row" }),
      1,
    );
    expect(text).not.toContain("\n");
    expect(text).toContain("subject:Line one line two | snip:a 0002 | fake row");
  });

  it("caps each field at 500 characters", () => {
    const fields = resultRow(source({ subject: "x".repeat(900) }), 1).text.split(" | ");
    expect(fields[7]).toBe(`subject:${"x".repeat(500)}`);
  });
});

describe("coverage and summarizeResults", () => {
  const done: MailQueryOutcome = {
    account: "me@example.com",
    q: "from:jana",
    complete: true,
    hasMore: false,
  };

  it("is complete when every query finished", () => {
    expect(coverage([done])).toEqual({ coverage: "complete" });
    expect(coverage([])).toEqual({ coverage: "complete" });
  });

  it("is capped with the oldest saved date among queries that stopped early", () => {
    const capped = (q: string, oldest: string | null): MailQueryOutcome => ({
      ...done,
      q,
      complete: false,
      hasMore: true,
      stoppedReason: "cap",
      oldest,
    });
    expect(
      coverage([
        done,
        capped("a", "2022-01-01T00:00:00.000Z"),
        capped("b", "2020-05-05T00:00:00.000Z"),
      ]),
    ).toEqual({ coverage: "capped", coveredBackTo: "2020-05-05T00:00:00.000Z" });
    expect(coverage([capped("a", null)])).toEqual({ coverage: "capped" });
  });

  it("summarizes dates, years, queries and accounts for complete results", () => {
    const rows = [
      row(1, { date: "2018-06-01T00:00:00.000Z" }),
      row(2, { date: "2018-07-01T00:00:00.000Z" }),
      row(3, { date: "2020-01-01T00:00:00.000Z" }),
    ];
    const summary = summarizeResults({
      rows,
      accounts: ["me@example.com"],
      queries: [{ ...done, oldest: "2018-06-01T00:00:00.000Z" }],
    });
    expect(summary).toEqual({
      records: 3,
      dateRange: { oldest: "2018-06-01T00:00:00.000Z", newest: "2020-01-01T00:00:00.000Z" },
      byYear: { "2018": 2, "2020": 1 },
      accounts: ["me@example.com"],
      perQuery: [done],
      coverage: "complete",
      firstRecords: rows.map((r) => r.text),
      lastRecords: [],
    });
    expect("failedAccounts" in summary).toBe(false);
    expect("coveredBackTo" in summary).toBe(false);
  });

  it("shows only the first and last 3 rows, each cut to 700 characters", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(i + 1, { snippet: "s".repeat(500), subject: "t".repeat(500) }),
    );
    const summary = summarizeResults({ rows, accounts: [], queries: [done] });
    expect(summary.firstRecords).toEqual(rows.slice(0, 3).map((r) => r.text.slice(0, 700)));
    expect(summary.lastRecords).toEqual(rows.slice(7).map((r) => r.text.slice(0, 700)));
    expect(summary.firstRecords[0]).toHaveLength(700);
  });

  it("adds coveredBackTo for capped results and failedAccounts only when an account failed", () => {
    const capped: MailQueryOutcome = {
      ...done,
      complete: false,
      hasMore: true,
      stoppedReason: "error",
      oldest: "2019-03-02T08:00:00.000Z",
    };
    const summary = summarizeResults({
      rows: [row(1)],
      accounts: ["me@example.com", "work@example.com"],
      queries: [capped],
      failedAccounts: ["work@example.com"],
    });
    expect(summary.coverage).toBe("capped");
    expect(summary.coveredBackTo).toBe("2019-03-02T08:00:00.000Z");
    expect(summary.failedAccounts).toEqual(["work@example.com"]);
    expect(summary.perQuery).toEqual([
      {
        account: "me@example.com",
        q: "from:jana",
        complete: false,
        hasMore: true,
        stoppedReason: "error",
      },
    ]);
    const none = summarizeResults({
      rows: [row(1)],
      accounts: [],
      queries: [done],
      failedAccounts: [],
    });
    expect("failedAccounts" in none).toBe(false);
  });

  it("reports an empty result with null dates", () => {
    expect(summarizeResults({ rows: [], accounts: ["me@example.com"], queries: [done] })).toEqual({
      records: 0,
      dateRange: { oldest: null, newest: null },
      byYear: {},
      accounts: ["me@example.com"],
      perQuery: [done],
      coverage: "complete",
      firstRecords: [],
      lastRecords: [],
    });
  });
});

describe("clampInt", () => {
  it("truncates, clamps, and falls back for non-numbers", () => {
    expect(clampInt(7.9, 1, 200, 50)).toBe(7);
    expect(clampInt(0, 1, 200, 50)).toBe(1);
    expect(clampInt(5000, 1, 200, 50)).toBe(200);
    expect(clampInt("12", 1, 200, 50)).toBe(50);
    expect(clampInt(undefined, 1, 200, 50)).toBe(50);
    expect(clampInt(Number.NaN, 1, 200, 50)).toBe(50);
  });
});

describe("pattern safety", () => {
  it("flags quantifiers outside character classes and backreferences", () => {
    for (const unsafe of ["a+", "a*", "a?", "a{1,99}", "(a+)+$", "a}", "(a)\\1", "(?<n>a)\\k<n>"]) {
      expect(isSafeRegexPattern(unsafe)).toBe(false);
    }
    for (const safe of ["jana|marie", "[a+*?]", "example\\.com", "a\\+b", "^from:", "\\d\\d"]) {
      expect(isSafeRegexPattern(safe)).toBe(true);
    }
  });

  it("limits patterns to 20 non-empty strings of 200 characters", () => {
    const many = Array.from({ length: 25 }, (_, i) => `p${i}`);
    expect(normalizePatterns(many)).toEqual(many.slice(0, 20));
    expect(normalizePatterns(["", "ok", 3, null])).toEqual(["ok"]);
    expect(normalizePatterns(["x".repeat(201)])).toEqual(["x".repeat(200)]);
    expect(normalizePatterns(undefined)).toEqual([]);
  });

  it("allows the ILIKE pre-filter exactly when every pattern matches as a plain substring", () => {
    expect(isLiteralOnly(["jana", "first hello"])).toBe(true);
    expect(isLiteralOnly(["(a+)+$"])).toBe(true);
    expect(isLiteralOnly(["[oops"])).toBe(true);
    expect(isLiteralOnly(["jana|marie"])).toBe(false);
    expect(isLiteralOnly(["a.b"])).toBe(false);
    expect(isLiteralOnly(["example\\.com"])).toBe(false);
    expect(isLiteralOnly(["jana", "x.y"])).toBe(false);
    expect(isLiteralOnly([])).toBe(false);
    expect(isLiteralOnly(undefined)).toBe(false);
  });
});

describe("grepRows", () => {
  const opts = { searchId: "s1" };

  it("ORs case-insensitive patterns", () => {
    const rows = rowsWithSubjects(["Alpha plan", "beta plan", "GAMMA plan", "delta plan"]);
    const result = grepRows(rows, { ...opts, patterns: ["alpha", "gamma"] });
    expect(lines(result)).toEqual([1, 3]);
    expect(result).toMatchObject({ searchId: "s1", totalMatches: 2, shown: 2 });
    expect(result.note).toBeUndefined();
  });

  it("supports safe regex syntax", () => {
    const rows = rowsWithSubjects(["a+b", "ab", "see foo.bar", "see fooXbar"]);
    expect(lines(grepRows(rows, { ...opts, patterns: ["subject:a\\+b"] }))).toEqual([1]);
    expect(lines(grepRows(rows, { ...opts, patterns: ["foo\\.bar"] }))).toEqual([3]);
    expect(lines(grepRows(rows, { ...opts, patterns: ["subject:ab|subject:a\\+b"] }))).toEqual([
      1, 2,
    ]);
  });

  it("matches quantifier, backreference and invalid patterns literally", () => {
    const rows = rowsWithSubjects([
      `${"a".repeat(5000)}!`,
      "(a+)+$",
      "(ab) \\1",
      "ab ab",
      "a{1,99}",
      "[oops",
      "aaa",
    ]);
    expect(lines(grepRows(rows, { ...opts, patterns: ["(a+)+$"] }))).toEqual([2]);
    expect(lines(grepRows(rows, { ...opts, patterns: ["(ab) \\1"] }))).toEqual([3]);
    expect(lines(grepRows(rows, { ...opts, patterns: ["a{1,99}"] }))).toEqual([5]);
    expect(lines(grepRows(rows, { ...opts, patterns: ["[oops"] }))).toEqual([6]);
  });

  it("cuts a long pattern to 200 characters and ignores a 21st pattern", () => {
    const rows = rowsWithSubjects([`${"x".repeat(200)} end`, "alpha"]);
    expect(lines(grepRows(rows, { ...opts, patterns: [`${"x".repeat(200)}ZZZ`] }))).toEqual([1]);
    const patterns = [...Array.from({ length: 20 }, (_, i) => `nomatch${i}`), "alpha"];
    expect(grepRows(rows, { ...opts, patterns }).totalMatches).toBe(0);
  });

  it("returns every row when there are no patterns", () => {
    const rows = rowsWithSubjects(["a", "b", "c"]);
    for (const patterns of [undefined, [], [""]]) {
      expect(lines(grepRows(rows, { ...opts, patterns }))).toEqual([1, 2, 3]);
    }
  });

  it("filters by ISO date prefix before matching", () => {
    const rows = [
      row(1, { date: "2017-12-31T23:00:00.000Z" }),
      row(2, { date: "2018-06-01T08:00:00.000Z" }),
      row(3, { date: "2019-01-01T00:00:00.000Z" }),
    ];
    expect(lines(grepRows(rows, { ...opts, dateFrom: "2018" }))).toEqual([2, 3]);
    expect(lines(grepRows(rows, { ...opts, dateFrom: "2018", dateTo: "2018" }))).toEqual([2]);
    expect(lines(grepRows(rows, { ...opts, dateFrom: "2018-06", dateTo: "2018-06-01" }))).toEqual([
      2,
    ]);
    expect(lines(grepRows(rows, { ...opts, dateTo: "2017" }))).toEqual([1]);
  });

  it("pages with afterLine and maxResults while totalMatches stays exact", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(i + 1));
    const first = grepRows(rows, { ...opts, maxResults: 3 });
    expect(lines(first)).toEqual([1, 2, 3]);
    expect(first).toMatchObject({
      totalMatches: 10,
      shown: 3,
      note: "truncated - refine patterns, dates, or maxResults",
    });
    const next = grepRows(rows, { ...opts, maxResults: 3, afterLine: 3 });
    expect(lines(next)).toEqual([4, 5, 6]);
    expect(next.totalMatches).toBe(7);
    expect(lines(grepRows(rows, { ...opts, afterLine: 8 }))).toEqual([9, 10]);
  });

  it("defaults to 50 results", () => {
    const rows = Array.from({ length: 120 }, (_, i) => row(i + 1));
    const result = grepRows(rows, opts);
    expect(result.shown).toBe(50);
    expect(result.totalMatches).toBe(120);
  });

  it("fits the 16,000 character budget, keeps the earliest matches and reports the cut", () => {
    const rows = Array.from({ length: 300 }, (_, i) =>
      row(i + 1, { snippet: "s".repeat(500), subject: "t".repeat(500) }),
    );
    const result = grepRows(rows, { ...opts, maxResults: 200 });
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(16_000);
    expect(result.totalMatches).toBe(300);
    expect(result.shown).toBe(result.matches.length);
    expect(result.shown).toBeGreaterThan(10);
    expect(result.shown).toBeLessThan(200);
    expect(lines(result)).toEqual(Array.from({ length: result.shown }, (_, i) => i + 1));
    expect(result.note).toBe("truncated - refine patterns, dates, or maxResults");
    expect(result.matches[0]?.text).toHaveLength(500);
  });

  it("budgetJson leaves a result that already fits untouched", () => {
    const small = { searchId: "s1", totalMatches: 1, shown: 1, matches: [{ line: 1, text: "x" }] };
    expect(budgetJson(small)).toEqual(small);
    const shrunk = budgetJson(
      {
        ...small,
        totalMatches: 2,
        shown: 2,
        matches: [
          { line: 1, text: "x" },
          { line: 2, text: "y".repeat(100) },
        ],
      },
      170,
    );
    expect(shrunk.matches).toEqual([{ line: 1, text: "x" }]);
    expect(shrunk.shown).toBe(1);
    expect(shrunk.note).toBeDefined();
  });

  it("returns neighbouring rows as context even when they do not match", () => {
    const rows = rowsWithSubjects(["one", "two", "needle", "four", "five"]);
    const result = grepRows(rows, { ...opts, patterns: ["needle"], contextLines: 1 });
    expect(result.matches).toEqual([
      {
        line: 3,
        text: rows
          .slice(1, 4)
          .map((r) => r.text)
          .join("\n"),
      },
    ]);
    const edge = grepRows(rowsWithSubjects(["needle", "two"]), {
      ...opts,
      patterns: ["needle"],
      contextLines: 5,
    });
    expect(edge.matches[0]?.text.split("\n")).toHaveLength(2);
  });

  it("clips each row in a context block to 500 characters", () => {
    const rows = rowsWithSubjects(["a", "needle"]).map((r) => ({
      ...r,
      text: `${r.text}${"z".repeat(900)}`,
    }));
    const result = grepRows(rows, { ...opts, patterns: ["needle"], contextLines: 1 });
    const blockRows = result.matches[0]?.text.split("\n") ?? [];
    expect(blockRows).toHaveLength(2);
    for (const r of blockRows) expect(r).toHaveLength(500);
  });

  it("gives the same answer from batches of 500 as from one pass", () => {
    const rows = Array.from({ length: 1200 }, (_, i) =>
      row(i + 1, { subject: i % 7 === 0 ? "needle" : "hay" }),
    );
    const options = { ...opts, patterns: ["needle"], maxResults: 20, contextLines: 1 };
    const onePass = grepRows(rows, options);
    const scan = createGrepScan(options);
    for (let i = 0; i < rows.length; i += 500) scan.add(rows.slice(i, i + 500));
    expect(scan.finish(rows)).toEqual(onePass);
    expect(onePass.totalMatches).toBe(Math.ceil(1200 / 7));
    expect(onePass.shown).toBe(20);
  });

  it("takes context from a separate read, as the SQL path does", () => {
    const rows = rowsWithSubjects(["one", "two", "needle", "four", "five"]);
    const options = { ...opts, patterns: ["needle"], contextLines: 2 };
    const scan = createGrepScan(options);
    scan.add([rows[2] as MailResultRow]);
    const wanted = scan.matchedLines().flatMap((m) => [m - 2, m - 1, m, m + 1, m + 2]);
    expect(scan.contextLines).toBe(2);
    expect(scan.finish(rows.filter((r) => wanted.includes(r.line)))).toEqual(
      grepRows(rows, options),
    );
  });
});

describe("stripQuotedReply", () => {
  const reply = "Sounds good, see you then.";

  it("cuts at an 'On … wrote:' line, including one wrapped over two lines", () => {
    expect(
      stripQuotedReply(
        `${reply}\n\nOn Mon, Jan 1, 2024 at 9:00 AM Jana <j@example.com> wrote:\n> hi`,
      ),
    ).toBe(reply);
    expect(
      stripQuotedReply(
        `${reply}\n\nOn Mon, Jan 1, 2024 at 9:00 AM Jana\n<j@example.com> wrote:\n> hi`,
      ),
    ).toBe(reply);
  });

  it("cuts at a forwarded message marker", () => {
    expect(stripQuotedReply(`${reply}\n---------- Forwarded message ---------\nFrom: x`)).toBe(
      reply,
    );
  });

  it("cuts at an Outlook-style From/Sent or From/Date header block", () => {
    expect(stripQuotedReply(`${reply}\n\nFrom: Jana\nSent: Monday\nTo: Me\nOld text`)).toBe(reply);
    expect(stripQuotedReply(`${reply}\n\nFrom: Jana\nDate: Monday\nTo: Me\nOld text`)).toBe(reply);
  });

  it("cuts at the earliest marker only", () => {
    const body = `${reply}\nOn Tue, Jana wrote:\nold\n---------- Forwarded message ---------`;
    expect(stripQuotedReply(body)).toBe(reply);
  });

  it("leaves a body without markers alone, and keeps one that is entirely quoted", () => {
    expect(stripQuotedReply(`${reply}\nFrom the desk of Jana`)).toBe(
      `${reply}\nFrom the desk of Jana`,
    );
    const quoted = "On Mon, Jana wrote:\n> everything is quoted";
    expect(stripQuotedReply(quoted)).toBe(quoted);
  });
});

describe("regressions", () => {
  it("does not backtrack on a catastrophic pattern against a long row", () => {
    const rows = [row(1, { subject: `${"a".repeat(40)}!` })];
    const started = performance.now();
    const result = grepRows(rows, { searchId: "s1", patterns: ["(a+)+$", "(a|aa)+$"] });
    expect(result.totalMatches).toBe(0);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("walks every row exactly once by following afterLine through budget cuts", () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      row(i + 1, { snippet: "s".repeat(400), subject: "t".repeat(400) }),
    );
    const seen: number[] = [];
    let afterLine = 0;
    for (let page = 0; page < 50; page++) {
      const result = grepRows(rows, { searchId: "s1", maxResults: 200, afterLine });
      if (result.matches.length === 0) break;
      seen.push(...lines(result));
      afterLine = result.matches[result.matches.length - 1]?.line ?? afterLine;
    }
    expect(seen).toEqual(rows.map((r) => r.line));
  });

  it("is exported from the package entry point", () => {
    expect(core.grepRows).toBe(grepRows);
    expect(core.resultRow).toBe(resultRow);
  });
});
