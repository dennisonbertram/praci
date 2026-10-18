import { categorySlug, vendorKey } from "@rakazo/core";
import { z } from "zod";
import {
  dollarsToCents,
  isoDay,
  mimeTypeFromName,
  parseToolResponse,
  toIso,
} from "./finance-source-util.js";
import type {
  FinanceCallTool,
  FinanceReceiptLink,
  FinanceSource,
  SourceAccount,
  SourceTransaction,
} from "./finance-sync.js";

const FIRST_PAGE_LIMIT = 300;
const MIN_PAGE_LIMIT = 10;
/** 300 a page, so this reads 600,000 transactions per account before giving up. */
const MAX_PAGES = 2_000;

const AccountsSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      lastFour: z.string().nullish(),
      status: z.string(),
      kind: z.string(),
      isCredit: z.boolean().nullish(),
      availableBalance: z.number(),
    }),
  ),
});

const TreasurySchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      availableBalance: z.number(),
      netReturns: z
        .array(
          z.object({
            month: z.string().regex(/^\d{4}-\d{2}/),
            netAmount: z.number(),
            dividends: z.array(z.object({ amount: z.number() })),
            treasuryFee: z.number(),
          }),
        )
        .nullish(),
    }),
  ),
});

const TransactionsSchema = z.object({
  transactions: z.array(
    z.object({
      id: z.string(),
      counterpartyName: z.string().nullish(),
      amount: z.number(),
      date: z.string(),
      status: z.string(),
      kind: z.string().nullish(),
      category: z.string().nullish(),
      dashboardLink: z.string().nullish(),
      attachmentsCount: z.number().nullish(),
    }),
  ),
  /** Set when the tool cut the page short; the page cannot be trusted. */
  truncatedAt: z.unknown().optional(),
  page: z.object({ nextPage: z.string().nullish() }).nullish(),
});

const TransactionDetailSchema = z.object({
  transaction: z.object({
    attachments: z
      .array(
        z.object({
          id: z.string().nullish(),
          url: z.string().nullish(),
          fileName: z.string().nullish(),
        }),
      )
      .nullish(),
  }),
});

const AttachmentSchema = z.object({
  url: z.string().nullish(),
  downloadUrl: z.string().nullish(),
  fileName: z.string().nullish(),
});

/**
 * Mercury through its MCP tools: getAccounts, getTreasury, listTransactions (paged by `start_after`,
 * newest first), getTransactionById and getAttachment for receipts. Never getCashflowSummary, which
 * counts Treasury transfers as flows.
 *
 * Observed live: listTransactions rows carry no account id, so transactions are read once per cash
 * account with `accountId`. With `order: "desc"` the rows come back in the order the cursor follows,
 * and the response has no `page.nextPage`, so a full page means "ask again after its last id".
 * A listing row does not say whether it has attachments, so `hasReceipt` stays false unless the row
 * carries `attachmentsCount`; `receiptUrl` looks the attachment up on demand.
 */
export function createMercuryFinanceSource(callTool: FinanceCallTool): FinanceSource {
  let accounts: Promise<z.infer<typeof AccountsSchema>["accounts"]> | undefined;
  let treasury: Promise<z.infer<typeof TreasurySchema>["accounts"]> | undefined;
  const loadAccounts = () =>
    // Accounts and Treasury are each read once per source, whichever method asks first.
    // ponytail: the first 1000 accounts only, which no one has.
    (accounts ??= callTool("getAccounts", {}).then(
      (data) => parseToolResponse(AccountsSchema, "getAccounts", data).accounts,
    ));
  const loadTreasury = () =>
    (treasury ??= callTool("getTreasury", {}).then(
      (data) => parseToolResponse(TreasurySchema, "getTreasury", data).accounts,
    ));

  /** Cash accounts only: credit accounts and unknown kinds are not cash and are skipped. */
  const cashAccounts = async () =>
    (await loadAccounts()).filter(
      (a) =>
        a.status === "active" && !a.isCredit && (a.kind === "checking" || a.kind === "savings"),
    );

  /** Shrinks when the tool truncates a page, and stays small for the rest of the sync. */
  let limit = FIRST_PAGE_LIMIT;

  async function readAll(
    accountId: string,
    filter: Record<string, unknown>,
  ): Promise<SourceTransaction[]> {
    const rows: SourceTransaction[] = [];
    const seen = new Set<string>();
    let startAfter: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = parseToolResponse(
        TransactionsSchema,
        "listTransactions",
        await callTool("listTransactions", {
          ...filter,
          accountId: [accountId],
          order: "desc",
          limit,
          ...(startAfter ? { start_after: startAfter } : {}),
        }),
      );
      if (response.truncatedAt != null && response.truncatedAt !== false) {
        if (limit <= MIN_PAGE_LIMIT) throw new Error("Mercury keeps truncating transaction pages");
        limit = Math.max(MIN_PAGE_LIMIT, Math.floor(limit / 2));
        continue;
      }
      const fresh = response.transactions.filter((t) => !seen.has(t.id));
      for (const t of fresh) {
        seen.add(t.id);
        rows.push(mapTransaction(t, accountId));
      }
      const last = response.transactions.at(-1);
      const next =
        response.page?.nextPage ?? (response.transactions.length >= limit ? last?.id : undefined);
      if (!next || fresh.length === 0) return rows;
      startAfter = next;
    }
    throw new Error("Mercury returned too many transaction pages");
  }

  return {
    provider: "mercury",

    async fetchAccounts(): Promise<SourceAccount[]> {
      const cash = (await cashAccounts()).map(
        (a): SourceAccount => ({
          provider: "mercury",
          externalId: a.id,
          name: a.name,
          lastFour: a.lastFour || null,
          kind: a.kind as "checking" | "savings",
          balanceCents: dollarsToCents(a.availableBalance),
          currency: "USD",
        }),
      );
      const treasuries = (await loadTreasury())
        .filter((t) => t.status === "active")
        .map(
          (t): SourceAccount => ({
            provider: "mercury",
            externalId: t.id,
            name: "Mercury Treasury",
            lastFour: null,
            kind: "treasury",
            balanceCents: dollarsToCents(t.availableBalance),
            currency: "USD",
          }),
        );
      return [...cash, ...treasuries];
    },

    async fetchTransactions(sinceISO): Promise<SourceTransaction[]> {
      const byId = new Map<string, SourceTransaction>();
      for (const account of await cashAccounts()) {
        // Pending rows have no posted date, so the date filter could hide them: read them apart.
        const pending = await readAll(account.id, { status: ["pending"] });
        const posted = await readAll(account.id, {
          status: ["sent"],
          postedStart: isoDay(sinceISO),
        });
        for (const t of [...pending, ...posted]) byId.set(t.externalId, t);
      }
      return [...byId.values()];
    },

    async fetchTreasuryYield() {
      return (await loadTreasury()).flatMap((t) =>
        (t.netReturns ?? []).map((r) => ({
          accountExternalId: t.id,
          month: r.month.slice(0, 7),
          dividendsCents: r.dividends.reduce((sum, d) => sum + dollarsToCents(d.amount), 0),
          // The tool reports the fee as a negative amount; stored as the positive cost.
          feeCents: Math.abs(dollarsToCents(r.treasuryFee)),
          netCents: dollarsToCents(r.netAmount),
        })),
      );
    },

    async receiptUrl(externalId): Promise<FinanceReceiptLink | null> {
      const detail = parseToolResponse(
        TransactionDetailSchema,
        "getTransactionById",
        await callTool("getTransactionById", { transactionId: externalId }),
      );
      for (const attachment of detail.transaction.attachments ?? []) {
        let url = attachment.url;
        let name = attachment.fileName;
        if (!url && attachment.id) {
          const full = parseToolResponse(
            AttachmentSchema,
            "getAttachment",
            await callTool("getAttachment", { attachmentId: attachment.id }),
          );
          url = full.url ?? full.downloadUrl;
          name = full.fileName ?? name;
        }
        if (url) return { url, mimeType: mimeTypeFromName(name) };
      }
      return null;
    },
  };
}

function mapTransaction(
  t: z.infer<typeof TransactionsSchema>["transactions"][number],
  accountExternalId: string,
): SourceTransaction {
  const counterparty = t.counterpartyName?.trim() || "Unknown";
  const key = vendorKey(counterparty);
  // Mercury can leave a payment to Brex uncategorized; it is a card bill, so it gets the category
  // Mercury gives one elsewhere, and does not read as an unexplained 'Uncategorized' expense.
  const cardBill = key === "brex" && t.amount < 0 && categorySlug(t.category) === "uncategorized";
  return {
    provider: "mercury",
    externalId: t.id,
    accountExternalId,
    postedAt: toIso(t.date, "listTransactions"),
    purchasedAt: null,
    amountCents: dollarsToCents(t.amount),
    currency: "USD",
    counterparty,
    vendorKey: key,
    category: cardBill ? "Credit & Loan Payments" : t.category || null,
    status: t.status === "sent" ? "posted" : t.status === "pending" ? "pending" : "other",
    kind: t.kind || "other",
    cardLastFour: null,
    cardholder: null,
    memo: null,
    hasReceipt: (t.attachmentsCount ?? 0) > 0,
    dashboardUrl: t.dashboardLink || null,
  };
}
