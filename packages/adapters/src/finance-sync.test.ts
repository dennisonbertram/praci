import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { fakeMercury, MERCURY_CHECKING, mercuryRow } from "./finance-fake-tools.js";
import { syncFinanceForUser } from "./finance-sync.js";

vi.mock("@rakazo/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/core")>()),
  classify: () => "spend",
}));

const scope = { spaceId: "space-1", userId: "user-1" };
const mercuryServer = { id: "srv-1", endpoint: "https://mcp.mercury.com/mcp" };

/** A Prisma stand-in that records SQL. `claim`: the throttle lets the sync start. `owned`: it still holds its claim when it writes. */
function setup(options: { claim: boolean; owned?: boolean }) {
  const statements: string[] = [];
  const record = async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return 1;
  };
  const tx = {
    $executeRaw: record,
    $queryRaw: async (strings: TemplateStringsArray) => {
      statements.push(strings.join("?"));
      return options.owned === false ? [] : [{}];
    },
    financeAccount: { findMany: async () => [] },
    financeBill: { deleteMany: async () => ({}) },
  };
  const transaction = vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx));
  const prisma = {
    mcpServer: { findMany: async () => [mercuryServer] },
    $executeRaw: record,
    $queryRaw: async () => (options.claim ? [{ lastSyncedAt: null }] : []),
    $transaction: transaction,
    financeAccount: { findMany: async () => [] },
    financeTransaction: { findMany: async () => [], updateMany: async () => ({}) },
  } as unknown as PrismaClient;
  const fake = fakeMercury({ txns: { [MERCURY_CHECKING]: [mercuryRow("m-1")] } });
  const callToolFor = vi.fn(async () => fake.callTool);
  const run = (opts = {}) => syncFinanceForUser({ prisma, callToolFor }, scope, opts);
  const wrote = () => statements.some((s) => /INSERT INTO finance_(accounts|transactions)/.test(s));
  const lastError = () => statements.find((s) => s.includes('"lastError"')) ?? "";
  return { run, callToolFor, transaction, wrote, lastError, statements };
}

describe("syncFinanceForUser", () => {
  it("skips a server that is throttled or claimed elsewhere without calling the vendor", async () => {
    const t = setup({ claim: false });
    expect(await t.run()).toEqual({ mercury: "skipped" });
    expect(t.callToolFor).not.toHaveBeenCalled();
    expect(t.transaction).not.toHaveBeenCalled();
  });

  it("writes nothing when the claim was lost while the vendor was read", async () => {
    const t = setup({ claim: true, owned: false });
    expect(await t.run()).toEqual({ mercury: "skipped" });
    expect(t.transaction).toHaveBeenCalledOnce();
    expect(t.wrote()).toBe(false);
  });

  it("records a short error and writes nothing when a response has an unknown shape", async () => {
    const t = setup({ claim: true });
    t.callToolFor.mockResolvedValue(async () => ({ accounts: "nope" }));
    expect(await t.run()).toEqual({ mercury: "failed" });
    expect(t.transaction).not.toHaveBeenCalled();
    expect(t.lastError()).toContain('"lastError"');
  });

  it("leaves the error state alone when the caller left", async () => {
    const t = setup({ claim: true });
    const controller = new AbortController();
    t.callToolFor.mockImplementation(async () => {
      controller.abort();
      throw new Error("aborted");
    });
    expect(await t.run({ signal: controller.signal })).toEqual({ mercury: "skipped" });
    expect(t.lastError()).toBe("");
  });
});
