import type { SpendPeriod } from "@rakazo/contracts";
import { SpendPeriodSchema } from "@rakazo/contracts";

/** Inclusive days, from a chart bar. */
export type SpendRange = { from: string; to: string };

export type FinanceRoute =
  | { page: "dashboard" }
  | { page: "accounts" }
  | { page: "account"; id: string }
  | { page: "burn" }
  | { page: "month"; month: string }
  | { page: "runway" }
  | { page: "crypto" }
  | { page: "spend"; period: SpendPeriod; category: string | null; range: SpendRange | null }
  | { page: "category"; slug: string }
  | { page: "recurring"; key: string }
  | { page: "vendor"; key: string }
  | { page: "transaction"; id: string }
  | { page: "receipt"; id: string }
  | { page: "not-found" };

const BASE = "/app/finance";
const enc = encodeURIComponent;

/** Every Finance URL in one place, so links and the route parser agree. */
export const financePath = {
  dashboard: () => BASE,
  accounts: () => `${BASE}/accounts`,
  account: (id: string) => `${BASE}/account/${enc(id)}`,
  burn: () => `${BASE}/burn`,
  month: (month: string) => `${BASE}/month/${enc(month)}`,
  runway: () => `${BASE}/runway`,
  crypto: () => `${BASE}/crypto`,
  spend: (period: SpendPeriod = "month", category?: string | null, range?: SpendRange | null) =>
    `${BASE}/spend?period=${period}${category ? `&cat=${enc(category)}` : ""}${
      range ? `&from=${range.from}&to=${range.to}` : ""
    }`,
  category: (slug: string) => `${BASE}/category/${enc(slug)}`,
  recurring: (key: string) => `${BASE}/recurring/${enc(key)}`,
  vendor: (key: string) => `${BASE}/vendor/${enc(key)}`,
  transaction: (id: string) => `${BASE}/transaction/${enc(id)}`,
  receipt: (id: string) => `${BASE}/receipt/${enc(id)}`,
};

const MONTH = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseFinanceRoute(pathname: string, search = ""): FinanceRoute {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : null;
  if (rest === null) return { page: "not-found" };
  const parts = rest.split("/").filter(Boolean);
  let arg: string | undefined;
  try {
    arg = parts[1] === undefined ? undefined : decodeURIComponent(parts[1]);
  } catch {
    return { page: "not-found" };
  }
  if (parts.length > 2) return { page: "not-found" };
  const [name] = parts;
  if (name === undefined) return { page: "dashboard" };
  if (arg === undefined) {
    if (name === "accounts" || name === "burn" || name === "runway" || name === "crypto")
      return { page: name };
    if (name === "spend") {
      const params = new URLSearchParams(search);
      const period = SpendPeriodSchema.safeParse(params.get("period"));
      const from = params.get("from") ?? "";
      const to = params.get("to") ?? "";
      return {
        page: "spend",
        period: period.success ? period.data : "month",
        category: params.get("cat") || null,
        range: DAY.test(from) && DAY.test(to) && from <= to ? { from, to } : null,
      };
    }
    return { page: "not-found" };
  }
  switch (name) {
    case "account":
    case "transaction":
    case "receipt":
      return { page: name, id: arg };
    case "month":
      return MONTH.test(arg) ? { page: "month", month: arg } : { page: "not-found" };
    case "category":
      return { page: "category", slug: arg };
    case "recurring":
    case "vendor":
      return { page: name, key: arg };
    default:
      return { page: "not-found" };
  }
}
