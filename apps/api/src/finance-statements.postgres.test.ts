import { createRouterClient } from "@orpc/server";
import { hasFinanceSource, parseStatement, syncFinanceForUser } from "@rakazo/adapters";
import type { Actor, ParsedStatement, StatementCheck } from "@rakazo/contracts";
import { STATEMENT_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRouter, type RouterDeps } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

// Invented text in the layout of a Wells Fargo business checking statement.
function fakeWellsFargo(closing: string) {
  const row = (d: string, desc: string, credit: string, debit: string, bal: string) =>
    `      ${d.padEnd(8)}${" ".repeat(10)}${desc.padEnd(60)}${credit.padStart(12)}${debit.padStart(14)}${bal.padStart(14)}`;
  return [
    "Navigate Business Checking SM",
    "March 31, 2026      Page 1 of 3",
    "Statement period activity summary                 Account number: 1234567890 (primary account)",
    "        Beginning balance on 3/1                       $1,000.00        EXAMPLE CORP",
    `        Ending balance on 3/31                         $${closing}        123 Example St`,
    "Wells Fargo Bank, N.A.",
    "Transaction history",
    `      Date      Number Description${" ".repeat(46)}${"Credits".padStart(12)}${"Debits".padStart(14)}${"balance".padStart(14)}`,
    row("3/2", "Example Transfer Ex-0001 Example Corp", "500.00", "", "1,500.00"),
    row("3/5", "WT 000001-000002 Example Bank /Bnf=Example Vendor", "", "250.25", "1,249.75"),
    row("3/20", "1042   Example Landlord", "", "100.00", "1,149.75"),
    row("3/31", "Interest Payment", "0.50", "", "1,150.25"),
    `      Totals${" ".repeat(60)}${"$500.50".padStart(12)}${"$350.25".padStart(14)}`,
  ].join("\n");
}

const line = (date: string, description: string, amountCents: number) => ({
  date,
  description,
  amountCents,
  balanceCents: null,
  externalId: null,
});
const fake = (
  periodStart: string,
  periodEnd: string,
  closingBalanceCents: number | null,
  transactions: ParsedStatement["transactions"],
  check: StatementCheck = { balances: "unavailable", differenceCents: null },
) => ({
  statement: {
    parser: "fake",
    institution: "Example Credit Union",
    accountName: "Everyday",
    accountLast4: "4242",
    currency: "USD" as const,
    periodStart,
    periodEnd,
    openingBalanceCents: null,
    closingBalanceCents,
    transactions,
    warnings: [],
  },
  check,
});

const fakes: Record<string, ReturnType<typeof fake>> = {
  "a.csv": fake("2026-03-01", "2026-03-15", 10_000, [
    line("2026-03-02", "Coffee Shop", -500),
    line("2026-03-02", "Coffee Shop", -500),
    line("2026-03-10", "Payroll", 11_000),
  ]),
  "b.csv": fake("2026-03-10", "2026-03-31", 20_000, [
    line("2026-03-10", "Payroll", 11_000),
    line("2026-03-20", "Rent", -1_000),
  ]),
  "older.csv": fake("2026-02-01", "2026-02-28", 5_000, [line("2026-02-03", "Gym", -2_000)]),
  "bad.csv": fake("2026-04-01", "2026-04-30", 1, [line("2026-04-03", "Fuel", -3_000)], {
    balances: "mismatch",
    differenceCents: 77,
  }),
};

const b64 = (text: string) => Buffer.from(text).toString("base64");

describePostgres("bank statement import (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `stmt-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userA = id("user-a");
  const userB = id("user-b");
  const actor = (userId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor(userA);
  const b = actor(userB);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const enqueued: unknown[] = [];

  const client = (who: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        env: { webOrigin: "https://app.example.com" },
        jobs: { enqueue: async (job: unknown) => void enqueued.push(job) },
        mcpOAuth: { statusFor: async () => "connected" },
        parseStatement: async (file: { fileName: string; bytes: Uint8Array }) => {
          const known = fakes[file.fileName];
          if (known) return known;
          return parseStatement(file, {
            pdfText: async (bytes) => fakeWellsFargo(new TextDecoder().decode(bytes).slice(9)),
          });
        },
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
  const upload = (who: Actor, fileName: string, body = "x") =>
    client(who).finance.statementUpload({ fileName, contentBase64: b64(body) });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const userId of [userA, userB]) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.financeStatement.deleteMany({ where: { spaceId } });
    await prisma.financeTransaction.deleteMany({ where: { spaceId } });
    await prisma.financeAccount.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("imports a Wells Fargo-shaped PDF into a new account, transactions and balance", async () => {
    const reviewed = await upload(a, "march.pdf", "%PDF-1.7 1,150.25");
    expect(reviewed).toMatchObject({
      status: "review",
      institution: "Wells Fargo",
      accountLast4: "7890",
      createsAccount: true,
      duplicateCount: 0,
      transactionCount: 4,
      check: { balances: "match" },
    });
    expect(await prisma.financeAccount.count({ where: { spaceId } })).toBe(0);

    const done = await client(a).finance.statementConfirm({ id: reviewed.id });
    expect(done.status).toBe("imported");
    const account = await prisma.financeAccount.findFirstOrThrow({ where: { spaceId } });
    expect(account).toMatchObject({
      userId: userA,
      provider: "statement",
      mcpServerId: null,
      kind: "checking",
      lastFour: "7890",
      balanceCents: 115025n,
    });
    expect(done.accountId).toBe(account.id);
    const txns = await prisma.financeTransaction.findMany({ where: { spaceId, userId: userA } });
    expect(txns).toHaveLength(4);
    expect(txns.every((t) => t.provider === "statement" && t.mcpServerId === null)).toBe(true);
    // Debits are spend, so they count in burn and spend.
    expect(txns.filter((t) => t.classification === "spend" && t.amountCents < 0n)).toHaveLength(2);
  });

  it("shows statement-only data without any connected source or sync", async () => {
    const overview = await client(a).finance.overview();
    expect(overview.sources.every((s) => s.status === "not_connected")).toBe(true);
    expect(overview.hasCashAccounts).toBe(true);
    expect(overview.cash.cashCents).toBe(115025);
    expect(overview.cash.bankCashCents).toBe(115025);
    expect(enqueued).toHaveLength(0);
    expect(overview.statementReminders).toEqual([
      expect.objectContaining({ coveredThrough: "2026-03-31", dueFor: "2026-04-30" }),
    ]);
    expect((await client(a).finance.accounts()).cash).toHaveLength(1);
    const detail = await client(a).finance.account({
      id: (await prisma.financeAccount.findFirstOrThrow({ where: { spaceId } })).id,
    });
    expect(detail.history.at(-1)?.balanceCents).toBe(115025);
    expect(detail.transactions).toHaveLength(4);
    expect(await hasFinanceSource(prisma, { spaceId, userId: userA })).toBe(true);
    expect(await hasFinanceSource(prisma, { spaceId, userId: userB })).toBe(false);
  });

  it("is never synced and its rows survive a sync", async () => {
    const result = await syncFinanceForUser(
      {
        prisma,
        callToolFor: async () => {
          throw new Error("no server expected");
        },
      },
      { spaceId, userId: userA },
      { force: true },
    );
    expect(result).toEqual({});
    expect(await prisma.financeAccount.count({ where: { spaceId, userId: userA } })).toBe(1);
    expect(await prisma.financeTransaction.count({ where: { spaceId, userId: userA } })).toBe(4);
  });

  it("matches the existing account and skips lines an overlapping statement repeats", async () => {
    const first = await upload(b, "a.csv");
    expect(first.createsAccount).toBe(true);
    await client(b).finance.statementConfirm({ id: first.id });
    const second = await upload(b, "b.csv");
    expect(second).toMatchObject({ createsAccount: false, duplicateCount: 1 });
    const done = await client(b).finance.statementConfirm({ id: second.id });
    expect(done.duplicateCount).toBe(1);

    const rows = await prisma.financeTransaction.findMany({ where: { spaceId, userId: userB } });
    // two identical coffees stay two lines; the overlapping payroll is not doubled
    expect(rows.map((r) => r.counterparty).sort()).toEqual([
      "Coffee Shop",
      "Coffee Shop",
      "Payroll",
      "Rent",
    ]);
    const account = await prisma.financeAccount.findFirstOrThrow({
      where: { spaceId, userId: userB },
    });
    expect(account.balanceCents).toBe(20_000n);
  });

  it("keeps the newest closing balance when an older statement arrives later", async () => {
    const older = await upload(b, "older.csv");
    await client(b).finance.statementConfirm({ id: older.id });
    const account = await prisma.financeAccount.findFirstOrThrow({
      where: { spaceId, userId: userB },
    });
    expect(account.balanceCents).toBe(20_000n);
    const detail = await client(b).finance.account({ id: account.id });
    expect(detail.history.at(-1)?.balanceCents).toBe(20_000);
  });

  it("blocks a balance mismatch until it is accepted", async () => {
    const bad = await upload(b, "bad.csv");
    expect(bad.check).toEqual({ balances: "mismatch", differenceCents: 77 });
    await expect(client(b).finance.statementConfirm({ id: bad.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      (await client(b).finance.statements()).statements.find((s) => s.id === bad.id),
    ).toMatchObject({
      status: "review",
    });
    const done = await client(b).finance.statementConfirm({ id: bad.id, acceptMismatch: true });
    expect(done.status).toBe("imported");
  });

  it("refuses to import the same statement twice", async () => {
    const one = await upload(a, "march.pdf", "%PDF-1.7 1,150.25");
    expect(one.duplicateCount).toBe(4);
    await client(a).finance.statementConfirm({ id: one.id });
    await expect(client(a).finance.statementConfirm({ id: one.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await prisma.financeTransaction.count({ where: { spaceId, userId: userA } })).toBe(4);
  });

  it("keeps each user's statements, accounts and files to themselves", async () => {
    const mine = await upload(a, "older.csv");
    await expect(client(b).finance.statementConfirm({ id: mine.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(client(b).finance.statementDiscard({ id: mine.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await client(b).finance.statements()).statements.map((s) => s.id)).not.toContain(
      mine.id,
    );
    // A's pending upload does not match or touch B's account of the same institution and last 4.
    expect(mine.createsAccount).toBe(true);
    await client(a).finance.statementDiscard({ id: mine.id });
    expect(await prisma.financeStatement.count({ where: { id: mine.id } })).toBe(0);
  });

  it("only discards statements that are not imported", async () => {
    const imported = (await client(a).finance.statements()).statements.find(
      (s) => s.status === "imported",
    );
    await expect(
      client(a).finance.statementDiscard({ id: imported?.id as string }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("enforces the size limit and allowed file types", async () => {
    const big = Buffer.alloc(STATEMENT_MAX_BYTES + 1).toString("base64");
    await expect(
      client(a).finance.statementUpload({ fileName: "big.csv", contentBase64: big }),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    await expect(upload(a, "notes.txt")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prisma.financeStatement.count({ where: { fileName: "big.csv" } })).toBe(0);
  });

  it("keeps a file that cannot be read as a failed statement with a readable reason", async () => {
    const failed = await upload(a, "garbage.csv", "not,a,statement");
    expect(failed.status).toBe("failed");
    expect(failed.error).toBeTruthy();
    expect(failed.error).not.toContain("not,a,statement");
    await client(a).finance.statementDiscard({ id: failed.id });
  });
});
