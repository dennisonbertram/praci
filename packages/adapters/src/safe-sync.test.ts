import { safeStatus } from "@rakazo/core";
import { describe, expect, it, vi } from "vitest";
import { createSafeCallToolFor, mapSafeRequest, readSafeRequests } from "./safe-sync.js";

/** Shaped like Mercury's documented SAFE request; every name and amount is invented. */
const request = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  documentUrl: `https://docs.example.test/safes/${id}.pdf`,
  expiresAt: "2099-01-01T00:00:00Z",
  includesMostFavoredNationClause: false,
  includesProRataRightsLetter: true,
  investmentAmount: 50_000.5,
  investmentDate: "2026-10-01",
  valuationType: "PostMoney",
  investor: {
    signatoryName: "Ada Example",
    signatoryEmail: "  Ada@Example.test ",
    legalEntityName: "Harbor Angels LLC",
    investorType: "SafeRequestInvestorTypeOther",
  },
  organization: {
    legalEntityName: "Example Co",
    signatoryName: "Founder Example",
    signatoryTitle: "CEO",
    signatoryEmail: "founder@example.test",
  },
  canceledAt: null,
  discountRate: null,
  governingState: "DE",
  paidAt: null,
  signedByInvestorAt: null,
  signedByOwnerAt: null,
  valuationCap: 10_000_000,
  ...over,
});

describe("mapSafeRequest", () => {
  it("maps the documented fields to cents, a normalized email and a post-money cap", () => {
    expect(mapSafeRequest(request("a"))).toMatchObject({
      externalId: "a",
      investorName: "Harbor Angels LLC",
      investorEmail: "ada@example.test",
      amountCents: 5_000_050,
      capCents: 1_000_000_000,
      valuationType: "post_money_cap",
      proRata: true,
      mfn: false,
      governingState: "DE",
    });
  });

  it("keeps a discount-only SAFE without a cap", () => {
    const row = mapSafeRequest(
      request("d", { valuationType: "NoValuation", valuationCap: null, discountRate: 20 }),
    );
    expect(row).toMatchObject({
      capCents: null,
      discountPercent: 20,
      valuationType: "no_valuation",
    });
  });

  it("returns null for a malformed row", () => {
    expect(mapSafeRequest({ id: "x" })).toBeNull();
    expect(mapSafeRequest(request("n", { investmentAmount: "lots" }))).toBeNull();
    expect(mapSafeRequest(null)).toBeNull();
    expect(mapSafeRequest(request("d", { investmentDate: "2026-99-99" }))).toBeNull();
    expect(mapSafeRequest(request("e", { paidAt: "2026-13-40T00:00:00Z" }))).toBeNull();
  });

  it("gives the status the documented fields imply", () => {
    const status = (over: Record<string, unknown>, now = new Date("2026-10-21T00:00:00Z")) => {
      const row = mapSafeRequest(request("s", over));
      return row && safeStatus({ ...row, source: "mercury", sentAt: null }, now);
    };
    expect(status({})).toBe("sent");
    expect(status({ canceledAt: "2026-10-05T00:00:00Z", paidAt: "2026-10-06T00:00:00Z" })).toBe(
      "canceled",
    );
    expect(status({ paidAt: "2026-10-06T00:00:00Z" })).toBe("funded");
    expect(
      status({
        signedByInvestorAt: "2026-10-02T00:00:00Z",
        signedByOwnerAt: "2026-10-03T00:00:00Z",
      }),
    ).toBe("signed");
    expect(status({ expiresAt: "2026-10-10T00:00:00Z" })).toBe("expired");
  });
});

describe("readSafeRequests", () => {
  it("counts a malformed row and keeps the readable ones", async () => {
    const callTool = vi.fn(async () => [request("a"), { id: "broken" }, request("b")]);
    const result = await readSafeRequests(callTool);
    expect(callTool).toHaveBeenCalledWith("getSafeRequests", {});
    expect(result.rows.map((r) => r.externalId)).toEqual(["a", "b"]);
    expect(result.unreadable).toBe(1);
  });

  it("accepts the list wrapped in an object and refuses any other answer", async () => {
    expect(
      (await readSafeRequests(async () => ({ safeRequests: [request("a")] }))).rows,
    ).toHaveLength(1);
    await expect(readSafeRequests(async () => ({ nope: true }))).rejects.toThrow();
  });
});

describe("createSafeCallToolFor", () => {
  const server = { id: "srv1" };
  const build = () => {
    const callServerTool = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "[]" }],
    }));
    const prisma = {
      mcpServer: {
        findUnique: vi.fn(async () => ({ id: "srv1", enabled: true, spaceId: "sp", userId: "u" })),
      },
    };
    const callToolFor = createSafeCallToolFor(prisma as never, { callServerTool } as never);
    return { callToolFor, callServerTool };
  };

  it("calls the SAFE read tools as the server's owner", async () => {
    const { callToolFor, callServerTool } = build();
    const call = await callToolFor(server, new AbortController().signal);
    expect(await call("getSafeRequests", {})).toEqual([]);
    expect(callServerTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: "srv1" }),
      expect.objectContaining({ spaceId: "sp", userId: "u" }),
      "getSafeRequests",
      {},
    );
  });

  it("refuses a write tool and a finance-only tool without calling Mercury", async () => {
    const { callToolFor, callServerTool } = build();
    const call = await callToolFor(server, new AbortController().signal);
    await expect(call("requestSendMoney", {})).rejects.toThrow(/may not call/);
    await expect(call("listTransactions", {})).rejects.toThrow(/may not call/);
    expect(callServerTool).not.toHaveBeenCalled();
  });
});
