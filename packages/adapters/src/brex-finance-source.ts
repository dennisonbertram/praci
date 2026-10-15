import { vendorKey } from "@rakazo/core";
import { z } from "zod";
import {
  dollarsToCents,
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

const PAGE_LIMIT = 100;
const MAX_PAGES = 1_000;

const Money = z.object({ value: z.string(), currency: z.string() });

const AccountsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      account_type: z.string().nullish(),
      account_number_last_four: z.string().nullish(),
      balance_breakdown: z.object({ available_balance: Money }),
    }),
  ),
  next_cursor: z.string().nullish(),
});

const ExpensesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      status: z.string().nullish(),
      payment_status: z.string().nullish(),
      receipt_count: z.number().nullish(),
      // Reimbursements send `receipts: null`.
      receipts: z.array(z.object({ download_uri: z.string().nullish() })).nullish(),
      memo: z.string().nullish(),
      purchased_at: z.string().nullish(),
      posted_at: z.string().nullish(),
      merchant: z.object({ name: z.string() }).nullish(),
      vendor: z.object({ name: z.string() }).nullish(),
      merchant_category: z.object({ name: z.string() }).nullish(),
      amount: Money,
      /** The USD amount charged to the account; `amount` is in the purchase currency for foreign spend. */
      billing_amount: Money.nullish(),
      user: z
        .object({ first_name: z.string().nullish(), last_name: z.string().nullish() })
        .nullish(),
      card: z.object({ last4: z.string().nullish() }).nullish(),
    }),
  ),
  next_cursor: z.string().nullish(),
});

const BillsSchema = z.object({
  items: z.array(z.unknown()),
  next_cursor: z.string().nullish(),
});

/** Bills are validated one by one: the shape was never observed live (the account had none). */
const BillSchema = z.object({
  id: z.string(),
  status: z.string().nullish(),
  due_at: z.string(),
  vendor: z.object({ name: z.string() }).nullish(),
  amount: Money.nullish(),
  billing_amount: Money.nullish(),
  original_amount: Money.nullish(),
});

const ReceiptsOnlySchema = z.object({
  receipts: z.array(z.object({ download_uri: z.string().nullish() })).nullish(),
});

/** Card declines and cancellations never moved money. */
const NO_MONEY_PAYMENT = new Set(["DECLINED", "CANCELED"]);
const NO_MONEY_EXPENSE = new Set(["CANCELED", "VOID"]);
/** A bill that is approved but not yet sent is "Upcoming" (a FinanceBill), not a transaction. */
const UNSENT_BILL_PAYMENT = new Set(["AWAITING_PAYMENT", "SCHEDULED", "NOT_STARTED", "HELD"]);
const PENDING_PAYMENT = new Set([
  "PROCESSING",
  "HELD",
  "AWAITING_PAYMENT",
  "SCHEDULED",
  "NOT_STARTED",
]);

/**
 * Brex through its MCP tools: list_business_accounts, list_expenses (include receipts, paged by
 * cursor, at most 100 a page) and list_bills. Every Brex tool call needs an `intent` string argument.
 *
 * Brex exposes no card balance owed, so no `card` account is produced. Card and bill expenses are
 * attributed to a synthetic account id per expense type (`brex-card`, `brex-billpay`, ...).
 */
export function createBrexFinanceSource(callTool: FinanceCallTool): FinanceSource {
  const call = (name: string, intent: string, args: Record<string, unknown>) =>
    callTool(name, { intent, ...args });

  async function pages<T>(
    fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; next_cursor?: string | null }>,
  ): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await fetchPage(cursor);
      items.push(...response.items);
      if (!response.next_cursor || response.items.length === 0) return items;
      cursor = response.next_cursor;
    }
    throw new Error("Brex returned too many pages");
  }

  return {
    provider: "brex",

    async fetchAccounts(): Promise<SourceAccount[]> {
      const items = await pages(async (cursor) =>
        parseToolResponse(
          AccountsSchema,
          "list_business_accounts",
          await call("list_business_accounts", "Finance dashboard: read account balances", {
            limit: PAGE_LIMIT,
            ...(cursor ? { cursor } : {}),
          }),
        ),
      );
      return (
        items
          // A card account's balance would be available credit, not the amount owed: skip it.
          .filter((a) => !/card/i.test(a.account_type ?? ""))
          .map((a) => ({
            provider: "brex" as const,
            externalId: a.id,
            name: a.name,
            lastFour: a.account_number_last_four || null,
            kind: "checking" as const,
            balanceCents: dollarsToCents(a.balance_breakdown.available_balance.value),
            currency: a.balance_breakdown.available_balance.currency,
          }))
      );
    },

    async fetchTransactions(sinceISO): Promise<SourceTransaction[]> {
      const items = await pages(async (cursor) =>
        parseToolResponse(
          ExpensesSchema,
          "list_expenses",
          await call("list_expenses", "Finance dashboard: read expenses and receipt presence", {
            limit: PAGE_LIMIT,
            include: ["receipts"],
            purchased_at_start: sinceISO,
            ...(cursor ? { cursor } : {}),
          }),
        ),
      );
      const byId = new Map<string, SourceTransaction>();
      for (const e of items) {
        if (NO_MONEY_PAYMENT.has(e.payment_status ?? "") || NO_MONEY_EXPENSE.has(e.status ?? ""))
          continue;
        if (e.type === "BILLPAY" && UNSENT_BILL_PAYMENT.has(e.payment_status ?? "")) continue;
        const counterparty =
          e.vendor?.name ??
          e.merchant?.name ??
          (e.type === "REIMBURSEMENT" ? "Reimbursement" : "Unknown");
        const purchasedAt = e.purchased_at ? toIso(e.purchased_at, "list_expenses") : null;
        const postedAt = e.posted_at ? toIso(e.posted_at, "list_expenses") : purchasedAt;
        if (!postedAt) continue;
        const money = e.billing_amount ?? e.amount;
        const cardholder = [e.user?.first_name, e.user?.last_name].filter(Boolean).join(" ");
        byId.set(e.id, {
          provider: "brex",
          externalId: e.id,
          accountExternalId: `brex-${e.type.toLowerCase()}`,
          postedAt,
          purchasedAt,
          // Brex amounts are positive for money spent.
          amountCents: -dollarsToCents(money.value),
          currency: money.currency,
          counterparty,
          vendorKey: vendorKey(counterparty),
          category: e.merchant_category?.name ?? null,
          status:
            e.payment_status === "CLEARED"
              ? "posted"
              : PENDING_PAYMENT.has(e.payment_status ?? "") || e.payment_status == null
                ? "pending"
                : "other",
          kind: e.type,
          cardLastFour: e.card?.last4 || null,
          cardholder: cardholder || null,
          memo: e.memo || null,
          hasReceipt: (e.receipts?.length ?? 0) > 0 || (e.receipt_count ?? 0) > 0,
          dashboardUrl: null,
        });
      }
      return [...byId.values()];
    },

    async fetchBills() {
      const items = await pages(async (cursor) =>
        parseToolResponse(
          BillsSchema,
          "list_bills",
          await call("list_bills", "Finance dashboard: read unpaid bills for the upcoming list", {
            statuses: ["SUBMITTED", "APPROVED", "DRAFT"],
            limit: PAGE_LIMIT,
            ...(cursor ? { cursor } : {}),
          }),
        ),
      );
      return items.flatMap((item) => {
        const bill = BillSchema.safeParse(item);
        const amount = bill.success
          ? (bill.data.amount ?? bill.data.billing_amount ?? bill.data.original_amount)
          : null;
        if (!bill.success || !amount || Number.isNaN(Date.parse(bill.data.due_at))) return [];
        const vendorName = bill.data.vendor?.name ?? "Unknown";
        return [
          {
            provider: "brex" as const,
            externalId: bill.data.id,
            vendorName,
            vendorKey: vendorKey(vendorName),
            dueAt: new Date(bill.data.due_at).toISOString(),
            amountCents: dollarsToCents(amount.value),
            status: bill.data.status ?? "UNKNOWN",
          },
        ];
      });
    },

    async receiptUrl(externalId): Promise<FinanceReceiptLink | null> {
      const expense = parseToolResponse(
        ReceiptsOnlySchema,
        "get_expense_by_id",
        await call("get_expense_by_id", "Finance dashboard: open a receipt", {
          id: externalId,
          include: ["receipts"],
        }),
      );
      const url = expense.receipts?.find((r) => r.download_uri)?.download_uri;
      return url ? { url, mimeType: mimeTypeFromName(url) } : null;
    },
  };
}
