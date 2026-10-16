// The normalized finance types live in @rakazo/contracts (one zod source, also used on the wire);
// this file re-exports them for the calculations and adds the inputs only the calculations use.
export type {
  BalancePoint,
  BreakdownMode,
  BreakdownRow,
  CashPoint,
  CashSummary,
  FinanceAccount,
  FinanceAccountKind,
  FinanceBill,
  FinanceClassification,
  FinanceProvider,
  FinanceRecordProvider,
  FinanceTransaction,
  FinanceTxnStatus,
  MonthCents,
  MonthlyBurn,
  MonthlyPoint,
  PaidWithEntry,
  RecurrenceCadence,
  RecurringCharge,
  Runway,
  SpendPeriod,
  SpendTotals,
  Subscription,
  Subscriptions,
  TreasuryYieldMonth,
  Upcoming,
  UpcomingItem,
} from "@rakazo/contracts";

import type { FinanceRecordProvider } from "@rakazo/contracts";

/** What `classify` reads from one provider transaction, before it has a classification. */
export interface FinanceRawTxn {
  provider: FinanceRecordProvider;
  /** Signed cents; negative means money out. */
  amountCents: number;
  counterparty: string;
  /** The provider's kind or expense type, unchanged. */
  kind: string;
  category: string | null;
}

export interface ClassifyContext {
  /** A Brex source is connected. Only then are Mercury payments to Brex card payments rather than spend. */
  brexConnected: boolean;
  /** Names of the user's own accounts (Mercury account names), to spot moves between them. */
  ownAccountNames: string[];
}

/** Half-open day range: `start` (YYYY-MM-DD) up to but not including `end`. */
export interface DayRange {
  start: string;
  end: string;
}

/** Narrows `monthlySpend` to one vendor, category or account; all given filters must match. */
export interface SpendFilter {
  vendorKey?: string;
  categorySlug?: string;
  accountExternalId?: string;
}
