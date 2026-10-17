import type { ParsedStatement, ParsedStatementTxn } from "@rakazo/contracts";
import { parseCents, unreadNote } from "./money.js";
import type { StatementParser } from "./types.js";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const AMOUNT_AT_END = /\s(-?[\d,]*\d\.\d{2})\s*$/;
const SKIP =
  /Page \d+ of \d+|Account number:|Transaction history|Date\s+(Check\s+)?Number|Deposits\/|Credits\s+Debits|^\s*[A-Z][a-z]+ \d{1,2}, \d{4}\s*$/;

/** Wells Fargo business checking statements ("Navigate Business Checking" and siblings). */
export const wellsFargoParser: StatementParser = {
  id: "wells-fargo-pdf",
  format: "pdf",
  detect: ({ text }) =>
    text &&
    /wells\s*fargo/i.test(text) &&
    /Transaction history/.test(text) &&
    /Beginning balance on/.test(text)
      ? 0.9
      : 0,
  async parse({ text }) {
    if (!text) throw new Error("No PDF text");
    const lines = text.split("\n");
    const warnings: string[] = [];

    const header = /([A-Z][a-z]+) (\d{1,2}), (\d{4})\s+Page \d+ of \d+/.exec(text);
    const endMonthName = header && MONTHS.indexOf(header[1]!.toLowerCase());
    if (!header || endMonthName === null || endMonthName < 0)
      throw new Error("Statement date not found");
    const endYear = Number(header[3]);
    const dayOf = (month: number, d: number) => {
      // A December line on a January statement belongs to the year before.
      const year = month > endMonthName + 1 ? endYear - 1 : endYear;
      return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    };
    const bal = (word: string) => {
      const m = new RegExp(
        `${word} balance on (\\d{1,2})/(\\d{1,2})\\s+\\$?(-?[\\d,]+\\.\\d{2})`,
        "i",
      ).exec(text);
      if (!m) throw new Error(`${word} balance not found`);
      return { date: dayOf(Number(m[1]), Number(m[2])), cents: parseCents(m[3]!)! };
    };
    const opening = bal("Beginning");
    const closing = bal("Ending");

    const accountNumber = /Account number:\s*(\d+)/.exec(text)?.[1] ?? "";
    const accountName =
      lines
        .map((l) => l.trim())
        .find((l) => /Checking|Savings/.test(l))
        ?.replace(/\s+SM$/, "") ?? null;

    // Column ends of the "Credits" and "Debits" headings decide the sign of an amount.
    const heading = lines.find((l) => /Credits\s+Debits/.test(l));
    if (!heading) throw new Error("Transaction table heading not found");
    const creditEnd = heading.indexOf("Credits") + "Credits".length;
    const debitEnd = heading.indexOf("Debits") + "Debits".length;

    const transactions: ParsedStatementTxn[] = [];
    let current: ParsedStatementTxn | null = null;
    let inTable = false;
    let unread = 0;
    for (const line of lines) {
      if (/Transaction history/.test(line)) inTable = true;
      if (!inTable) continue;
      if (/^\s*Totals\b|The Ending Daily Balance/.test(line)) {
        if (/^\s*Totals\b/.test(line)) inTable = false;
        current = null;
        continue;
      }
      if (!line.trim()) continue;
      const dated = /^\s*(\d{1,2})\/(\d{1,2})\s+(.*)$/.exec(line);
      if (dated) {
        let body = line.trimEnd();
        const tokens: Array<{ cents: number; end: number }> = [];
        for (
          let m = AMOUNT_AT_END.exec(body);
          m && tokens.length < 2;
          m = AMOUNT_AT_END.exec(body)
        ) {
          tokens.unshift({ cents: parseCents(m[1]!)!, end: body.length });
          body = body.slice(0, body.length - m[0].length).trimEnd();
        }
        const rest = body.replace(/^\s*\d{1,2}\/\d{1,2}\s+/, "");
        const first = tokens[0];
        if (!first) {
          unread++;
          current = null;
          continue;
        }
        const isDebit = Math.abs(first.end - debitEnd) < Math.abs(first.end - creditEnd);
        const check = /^(\d{3,6})\s{2,}/.exec(rest);
        // "<" is a footnote marker (legend: "< Business to Business ACH: ..."), not part of the text.
        const description = (check ? `Check ${check[1]} ${rest.slice(check[0].length)}` : rest)
          .replace(/^<\s*/, "")
          .replace(/\s+/g, " ")
          .trim();
        current = {
          date: dayOf(Number(dated[1]), Number(dated[2])),
          description,
          amountCents: isDebit ? -Math.abs(first.cents) : Math.abs(first.cents),
          balanceCents: tokens[1]?.cents ?? null,
          externalId: null,
        };
        transactions.push(current);
      } else if (
        SKIP.test(line) ||
        /^\s*<\s/.test(line) ||
        (accountName && line.includes(accountName))
      ) {
      } else if (current && /^\s{10,}\S/.test(line)) {
        current.description = `${current.description} ${line.trim()}`.slice(0, 500);
      } else unread++;
    }
    if (unread)
      warnings.push(
        unreadNote(unread, "line in the transaction table", "lines in the transaction table"),
      );
    if (!transactions.length) warnings.push("No transactions found.");

    return {
      parser: "wells-fargo-pdf",
      institution: "Wells Fargo",
      accountName,
      accountLast4: accountNumber.length >= 4 ? accountNumber.slice(-4) : null,
      currency: "USD",
      periodStart: opening.date,
      periodEnd: closing.date,
      openingBalanceCents: opening.cents,
      closingBalanceCents: closing.cents,
      transactions,
      warnings,
    } satisfies ParsedStatement;
  },
};
