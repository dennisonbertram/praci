import { describe, expect, it } from "vitest";
import { financePath, parseFinanceRoute } from "./finance-route";

describe("parseFinanceRoute", () => {
  it("reads the dashboard and the list pages", () => {
    expect(parseFinanceRoute("/app/finance")).toEqual({ page: "dashboard" });
    expect(parseFinanceRoute("/app/finance/")).toEqual({ page: "dashboard" });
    expect(parseFinanceRoute("/app/finance/accounts")).toEqual({
      page: "accounts",
      source: null,
    });
    expect(parseFinanceRoute("/app/finance/burn")).toEqual({ page: "burn" });
    expect(parseFinanceRoute("/app/finance/runway")).toEqual({ page: "runway" });
    expect(parseFinanceRoute(financePath.crypto())).toEqual({ page: "crypto" });
    expect(parseFinanceRoute("/app/finance/crypto/x")).toEqual({ page: "not-found" });
  });

  it("builds and reads the accounts source filter, flagging unknown sources", () => {
    expect(financePath.accounts()).toBe("/app/finance/accounts");
    expect(financePath.accounts("brex")).toBe("/app/finance/accounts?source=brex");
    expect(parseFinanceRoute("/app/finance/accounts", "?source=mercury")).toEqual({
      page: "accounts",
      source: "mercury",
    });
    expect(parseFinanceRoute("/app/finance/accounts", "?source=plaid")).toEqual({
      page: "accounts",
      source: null,
      unknownSource: "plaid",
    });
  });

  it("round-trips every detail path it builds", () => {
    const cases = [
      financePath.account("acc 1"),
      financePath.month("2026-09"),
      financePath.category("servers-cloud"),
      financePath.recurring("google workspace/x"),
      financePath.vendor("acme & co"),
      financePath.transaction("txn_1"),
      financePath.receipt("txn_1"),
    ];
    const parsed = cases.map((path) => parseFinanceRoute(path));
    expect(parsed).toEqual([
      { page: "account", id: "acc 1" },
      { page: "month", month: "2026-09" },
      { page: "category", slug: "servers-cloud" },
      { page: "recurring", key: "google workspace/x" },
      { page: "vendor", key: "acme & co" },
      { page: "transaction", id: "txn_1" },
      { page: "receipt", id: "txn_1" },
    ]);
  });

  it("reads the spend period and category, defaulting an unknown period to month", () => {
    expect(parseFinanceRoute("/app/finance/spend", "?period=quarter&cat=travel")).toEqual({
      page: "spend",
      period: "quarter",
      category: "travel",
      range: null,
    });
    expect(parseFinanceRoute("/app/finance/spend", "?period=decade")).toEqual({
      page: "spend",
      period: "month",
      category: null,
      range: null,
    });
    const built = new URL(financePath.spend("week", "a b"), "http://localhost");
    expect(parseFinanceRoute(built.pathname, built.search)).toEqual({
      page: "spend",
      period: "week",
      category: "a b",
      range: null,
    });
  });

  it("round-trips a from/to range and ignores a malformed or reversed one", () => {
    const built = new URL(
      financePath.spend("week", null, { from: "2026-10-06", to: "2026-10-12" }),
      "http://localhost",
    );
    expect(parseFinanceRoute(built.pathname, built.search)).toMatchObject({
      range: { from: "2026-10-06", to: "2026-10-12" },
    });
    expect(parseFinanceRoute("/app/finance/spend", "?from=2026-10-12&to=2026-10-06")).toMatchObject(
      {
        range: null,
      },
    );
    expect(parseFinanceRoute("/app/finance/spend", "?from=x&to=y")).toMatchObject({ range: null });
  });

  it("rejects unknown pages, a malformed month and extra segments", () => {
    expect(parseFinanceRoute("/app/finance/nope").page).toBe("not-found");
    expect(parseFinanceRoute("/app/finance/month/October").page).toBe("not-found");
    expect(parseFinanceRoute("/app/finance/vendor/a/b").page).toBe("not-found");
    expect(parseFinanceRoute("/app/finance/vendor/%E0%A4%A").page).toBe("not-found");
    expect(parseFinanceRoute("/app/inbox").page).toBe("not-found");
  });
});
