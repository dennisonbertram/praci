import type { ParsedStatement, ParsedStatementTxn } from "@rakazo/contracts";
import { decodeText, fileStem, parseCents, unreadNote } from "./money.js";
import type { StatementParser } from "./types.js";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Value of the first `<TAG>value` in `block`; works for OFX 1.x (no end tags) and 2.x (XML). */
function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>\\s*([^<\\r\\n]*)`, "i").exec(block);
  const value = m?.[1]?.trim().replace(/&(\w+);/g, (all, e: string) => ENTITIES[e] ?? all);
  return value || null;
}

/** "20260315120000.000[-5:EST]" to "2026-03-15". */
function day(raw: string | null): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const ofxParser: StatementParser = {
  id: "ofx",
  format: "ofx",
  detect: ({ bytes }) => {
    const head = decodeText(bytes.subarray(0, 2000));
    return /OFXHEADER|<OFX[\s>]/i.test(head) ? 1 : 0;
  },
  async parse({ fileName, bytes }) {
    const text = decodeText(bytes);
    const warnings: string[] = [];
    const transactions: ParsedStatementTxn[] = [];
    let skipped = 0;
    for (const m of text.matchAll(
      /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi,
    )) {
      const block = m[1]!;
      const date = day(tag(block, "DTPOSTED"));
      const amount = parseCents(tag(block, "TRNAMT") ?? "");
      if (!date || amount === null) {
        skipped++;
        continue;
      }
      const name = tag(block, "NAME");
      const memo = tag(block, "MEMO");
      const description = [name, memo && memo !== name ? memo : null].filter(Boolean).join(" - ");
      transactions.push({
        date,
        description: (description || tag(block, "TRNTYPE") || "Transaction").slice(0, 500),
        amountCents: amount,
        balanceCents: null,
        externalId: tag(block, "FITID")?.slice(0, 200) ?? null,
      });
    }
    // The product is USD-only: refuse any other currency rather than import it as dollars.
    const currencies = [
      tag(text, "CURDEF"),
      ...[...text.matchAll(/<(?:ORIG)?CURRENCY>([\s\S]*?)(?=<\/|<STMTTRN>|<TRN|$)/gi)].map((c) =>
        tag(c[1]!, "CURSYM"),
      ),
    ];
    const foreign = currencies.find((c) => c && c.toUpperCase() !== "USD");
    if (foreign) {
      throw new Error(
        `This statement is in ${foreign.toUpperCase().slice(0, 3)}. Only USD statements can be imported.`,
      );
    }
    if (skipped) warnings.push(unreadNote(skipped, "transaction", "transactions"));
    const dates = transactions.map((t) => t.date).sort();
    const periodStart = day(tag(text, "DTSTART")) ?? dates[0];
    const periodEnd = day(tag(text, "DTEND")) ?? dates.at(-1);
    if (!periodStart || !periodEnd)
      throw new Error("OFX file has no statement period or transactions");
    const ledger =
      /<LEDGERBAL>([\s\S]*?)(?=<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>|<\/CCSTMTRS>|$)/i.exec(text);
    const closing = ledger ? parseCents(tag(ledger[1]!, "BALAMT") ?? "") : null;
    const acct = /<(?:BANK|CC)ACCTFROM>([\s\S]*?)(?=<\/(?:BANK|CC)ACCTFROM>|$)/i.exec(text);
    const acctId = acct ? (tag(acct[1]!, "ACCTID") ?? "").replace(/\D/g, "") : "";
    const acctType = acct ? tag(acct[1]!, "ACCTTYPE")?.toUpperCase() : undefined;
    const accountKind =
      /<CCACCTFROM>/i.test(text) || acctType === "CREDITLINE"
        ? "card"
        : acctType === "SAVINGS" || acctType === "MONEYMRKT"
          ? "savings"
          : "checking";
    const institution = tag(text, "ORG") ?? tag(text, "FID");
    if (!institution) warnings.push("The file does not name its institution; used the file name.");
    warnings.push("OFX files carry no opening balance, so the balance check is unavailable.");
    return {
      parser: "ofx",
      institution: (institution ?? fileStem(fileName)).slice(0, 200),
      accountName: null,
      accountLast4: acctId.length >= 4 ? acctId.slice(-4) : null,
      currency: "USD",
      accountKind,
      periodStart,
      periodEnd,
      openingBalanceCents: null,
      closingBalanceCents: closing,
      transactions,
      warnings,
    } satisfies ParsedStatement;
  },
};
