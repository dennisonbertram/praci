import type { ParsedStatement, ParsedStatementTxn } from "@rakazo/contracts";
import { dsvFormat } from "d3-dsv";
import { decodeText, fileStem, parseCents } from "./money.js";
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
      return { rows: rows.slice(i + 1), cols };
    }
  }
  return null;
}

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
    const { rows, cols } = found;
    const warnings: string[] = [];
    const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const body = rows.filter((r) => cell(r, cols.date));
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
    if (skipped) warnings.push(`${skipped} row(s) could not be read.`);
    if (!txns.length) throw new Error("CSV has no readable transactions");
    // Newest-first exports are common; put them oldest-first so balances follow.
    if (txns[0]!.date > txns.at(-1)!.date) txns = txns.reverse();
    const first = txns[0]!;
    const last = txns.at(-1)!;
    warnings.push("The file does not name its institution; used the file name.");
    return {
      parser: "csv",
      institution: fileStem(fileName).slice(0, 200),
      accountName: null,
      accountLast4: null,
      currency: "USD",
      periodStart: txns.reduce((a, t) => (t.date < a ? t.date : a), first.date),
      periodEnd: txns.reduce((a, t) => (t.date > a ? t.date : a), last.date),
      openingBalanceCents:
        first.balanceCents === null ? null : first.balanceCents - first.amountCents,
      closingBalanceCents: last.balanceCents,
      transactions: txns,
      warnings,
    } satisfies ParsedStatement;
  },
};
