import type { ParsedStatement, ParsedStatementTxn } from "@rakazo/contracts";
import { dsvFormat } from "d3-dsv";
import { decodeText, fileStem, parseCents, unreadNote } from "./money.js";
import type { StatementParser } from "./types.js";

const DELIMITERS = [",", ";", "\t", "|"];
const HEADERS = {
  date: ["date", "posting date", "posted date", "transaction date", "post date", "trans date"],
  description: ["description", "payee", "memo", "details", "name", "narrative"],
  amount: ["amount", "transaction amount"],
  debit: ["debit", "debits", "withdrawal", "withdrawals", "money out"],
  credit: ["credit", "credits", "deposit", "deposits", "money in"],
  balance: ["balance", "running balance", "ending balance"],
};
type Columns = Record<keyof typeof HEADERS, number>;

function sniff(text: string) {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 15);
  const delimiter = DELIMITERS.map((d) => ({
    d,
    n: lines.reduce((s, l) => s + l.split(d).length - 1, 0),
  })).sort((a, b) => b.n - a.n)[0]!.d;
  const rows = dsvFormat(delimiter).parseRows(text.trim());
  for (const [i, row] of rows.slice(0, 15).entries()) {
    const names = row.map((c) => c.trim().toLowerCase());
    const find = (key: keyof typeof HEADERS) => names.findIndex((n) => HEADERS[key].includes(n));
    const cols: Columns = {
      date: find("date"),
      description: find("description"),
      amount: find("amount"),
      debit: find("debit"),
      credit: find("credit"),
      balance: find("balance"),
    };
    if (cols.date >= 0 && (cols.amount >= 0 || (cols.debit >= 0 && cols.credit >= 0))) {
      return { before: rows.slice(0, i), rows: rows.slice(i + 1), cols };
    }
  }
  return null;
}

const OPENING = /^(?:opening|beginning|starting|previous) balance\b/i;
const CLOSING = /^(?:closing|ending|new|statement) balance\b/i;
const LAST4 = /(?:ending(?: in)?|acct|account|no\.?|#|[x*•]{2,})\s*:?\s*[x*•]*(\d{4})\b/i;

/** A "Closing balance,10000.00" style row: its label and the first amount after it. */
function balanceRow(row: string[]): { kind: "opening" | "closing"; cents: number } | null {
  const label = (row.find((c) => c.trim()) ?? "").trim();
  const kind = OPENING.test(label) ? "opening" : CLOSING.test(label) ? "closing" : null;
  if (!kind) return null;
  const value = row.slice(row.indexOf(label) + 1).find((c) => parseCents(c) !== null);
  // The label may carry its value ("Closing balance: 10,000.00").
  const inline = /[-(]?\$?[\d,]+(?:\.\d{1,2})?\)?\s*$/.exec(label)?.[0];
  const cents = value !== undefined ? parseCents(value) : inline ? parseCents(inline) : null;
  return cents === null ? null : { kind, cents };
}

/** Titles like "Transaction History" name the report, not a bank; they must not decide account identity. */
const GENERIC_TITLE =
  /^(?:(?:account|transaction|transactions|statement|activity|history|summary|details|download(?:ed)?|export(?:ed)?|report|recent|csv|data|for|of|my|the|and)\b\W*)+$/i;

/** The bank and account ending named on a title line above the column header, if any. */
function titleOf(before: string[][]): { institution: string | null; last4: string | null } {
  let institution: string | null = null;
  let last4: string | null = null;
  for (const row of before) {
    if (balanceRow(row)) continue;
    for (const raw of row) {
      const cell = raw.trim();
      if (!cell) continue;
      const found = LAST4.exec(cell);
      if (found && !last4) last4 = found[1] as string;
      const name = cell
        .replace(LAST4, "")
        .replace(/[\s,:–—-]+$/, "")
        .trim();
      if (
        !institution &&
        /\p{L}{2,}/u.test(name) &&
        !/^(?:account|statement)\b/i.test(name) &&
        !GENERIC_TITLE.test(name)
      )
        institution = name;
    }
  }
  return { institution, last4 };
}

const DATE_CELL = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/;

type DateOrder = "ymd" | "mdy" | "dmy";

function dateOrder(values: string[]): { order: DateOrder; ambiguous: boolean } {
  const parts = values.map((v) => /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})/.exec(v.trim()));
  if (parts.some((p) => p && p[1]!.length === 4)) return { order: "ymd", ambiguous: false };
  const firstOver12 = parts.some((p) => p && Number(p[1]) > 12);
  const secondOver12 = parts.some((p) => p && Number(p[2]) > 12);
  if (firstOver12 && !secondOver12) return { order: "dmy", ambiguous: false };
  if (secondOver12 && !firstOver12) return { order: "mdy", ambiguous: false };
  return { order: "mdy", ambiguous: !firstOver12 && !secondOver12 };
}

function toDay(value: string, order: DateOrder): string | null {
  const m = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})/.exec(value.trim());
  if (!m) return null;
  let [y, mo, d] =
    order === "ymd"
      ? [m[1]!, m[2]!, m[3]!]
      : order === "mdy"
        ? [m[3]!, m[1]!, m[2]!]
        : [m[3]!, m[2]!, m[1]!];
  if (y.length === 2) y = `20${y}`;
  if (y.length !== 4 || Number(mo) > 12 || Number(d) > 31 || !Number(mo) || !Number(d)) return null;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const csvParser: StatementParser = {
  id: "csv",
  format: "csv",
  detect: ({ fileName, bytes }) => {
    const found = sniff(decodeText(bytes.subarray(0, 8000)));
    return found ? (/\.(csv|txt)$/i.test(fileName) ? 0.6 : 0.4) : 0;
  },
  async parse({ fileName, bytes }) {
    const found = sniff(decodeText(bytes));
    if (!found) throw new Error("CSV has no recognizable Date and Amount (or Debit/Credit) header");
    const { before, rows, cols } = found;
    const warnings: string[] = [];
    const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const dated = (r: string[]) => DATE_CELL.test(cell(r, cols.date));
    // Stated balances may sit above the header or below the last line; they are not transactions.
    const stated: { opening?: number; closing?: number } = {};
    for (const row of [...before, ...rows]) {
      const found = dated(row) ? null : balanceRow(row);
      if (found) stated[found.kind] ??= found.cents;
    }
    // A balance-summary row ("Closing balance,10000.00") has no date; a dated row is a transaction
    // even when its description starts with "Opening balance".
    const summary = (r: string[]) => !dated(r) && balanceRow(r) !== null;
    const body = rows.filter((r) => cell(r, cols.date) && !summary(r));
    const undated = rows.filter(
      (r) => !cell(r, cols.date) && r.some((c) => c.trim()) && !balanceRow(r),
    ).length;
    const { order, ambiguous } = dateOrder(body.map((r) => cell(r, cols.date)));
    if (ambiguous) warnings.push("Dates like 03/04/2026 are ambiguous; read as month/day/year.");
    let skipped = 0;
    let txns: ParsedStatementTxn[] = [];
    for (const row of body) {
      const date = toDay(cell(row, cols.date), order);
      let amount: number | null;
      if (cols.amount >= 0) amount = parseCents(cell(row, cols.amount));
      else {
        const debit = parseCents(cell(row, cols.debit)) ?? 0;
        const credit = parseCents(cell(row, cols.credit)) ?? 0;
        amount = Math.abs(credit) - Math.abs(debit);
      }
      if (!date || amount === null) {
        skipped++;
        continue;
      }
      txns.push({
        date,
        description: (cell(row, cols.description) || "Transaction").slice(0, 500),
        amountCents: amount,
        balanceCents: cols.balance >= 0 ? parseCents(cell(row, cols.balance)) : null,
        externalId: null,
      });
    }
    skipped += undated;
    if (skipped) warnings.push(unreadNote(skipped, "row", "rows"));
    if (!txns.length) throw new Error("CSV has no readable transactions");
    // Newest-first exports are common; put them oldest-first so balances follow.
    if (txns[0]!.date > txns.at(-1)!.date) txns = txns.reverse();
    const first = txns[0]!;
    const last = txns.at(-1)!;
    const title = titleOf(before);
    if (!title.institution)
      warnings.push("The file does not name its institution; used the file name.");
    return {
      parser: "csv",
      institution: (title.institution ?? fileStem(fileName)).slice(0, 200),
      accountName: null,
      accountLast4: title.last4,
      currency: "USD",
      periodStart: txns.reduce((a, t) => (t.date < a ? t.date : a), first.date),
      periodEnd: txns.reduce((a, t) => (t.date > a ? t.date : a), last.date),
      openingBalanceCents:
        stated.opening ??
        (first.balanceCents === null ? null : first.balanceCents - first.amountCents),
      closingBalanceCents: stated.closing ?? last.balanceCents,
      transactions: txns,
      warnings,
    } satisfies ParsedStatement;
  },
};
