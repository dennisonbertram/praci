import { createRouterClient } from "@orpc/server";
import { hasFinanceSource, parseStatement, syncFinanceForUser } from "@rakazo/adapters";
import type { Actor, ParsedStatement, StatementCheck } from "@rakazo/contracts";
import { STATEMENT_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

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
  // Opens at $250.00 although March closed at $200.00.
  "gap.csv": (() => {
    const f = fake("2026-04-01", "2026-04-30", 24_000, [line("2026-04-03", "Fuel", -1_000)]);
    return { ...f, statement: { ...f.statement, openingBalanceCents: 25_000 } };
  })(),
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
  const upload = (who: Actor, fileName: string, body = fileName) =>
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

  it("renames a statement account for its owner only", async () => {
    const account = await prisma.financeAccount.findFirstOrThrow({ where: { spaceId } });
    await expect(
      client(b).finance.statementAccountRename({ id: account.id, name: "Not mine" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client(a).finance.statementAccountRename({ id: account.id, name: "   " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await client(a).finance.statementAccountRename({
      id: account.id,
      name: "  Operating account ",
    });
    const renamed = await prisma.financeAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(renamed.name).toBe("Operating account");
    // The statement list names the account as it is called now, not as the file named it.
    const { statements } = await client(a).finance.statements();
    expect(statements.find((s) => s.accountId === account.id)?.accountName).toBe(
      "Operating account",
    );
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

  it("says when a statement does not continue from the one before it", async () => {
    const gap = await upload(b, "gap.csv");
    expect(gap.warnings).toContain(
      "This statement opens at $250.00, but the one before it closed at $200.00.",
    );
    await client(b).finance.statementDiscard({ id: gap.id });
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
    // Different bytes (a trailing newline), same lines: an overlapping statement, not the same file.
    const one = await upload(a, "march.pdf", "%PDF-1.7 1,150.25\n");
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

  describe("undoing an imported statement", () => {
    const undoFake = (
      last4: string,
      periodStart: string,
      periodEnd: string,
      closing: number,
      transactions: ParsedStatement["transactions"],
    ) => {
      const base = fake(periodStart, periodEnd, closing, transactions);
      return {
        ...base,
        statement: { ...base.statement, institution: "Undo Bank", accountLast4: last4 },
      };
    };
    const importFile = async (who: Actor, name: string) => {
      const reviewed = await upload(who, name);
      return client(who).finance.statementConfirm({ id: reviewed.id });
    };
    const state = async (last4: string) => ({
      account: await prisma.financeAccount.findFirst({ where: { spaceId, lastFour: last4 } }),
      txns: (
        await prisma.financeTransaction.findMany({
          where: { spaceId, userId: userA, counterparty: { startsWith: `Undo ${last4}` } },
        })
      )
        .map((t) => t.counterparty)
        .sort(),
    });
    const setup = (last4: string) => {
      const t1 = line("2026-03-02", `Undo ${last4} Coffee`, -500);
      const t2 = line("2026-03-10", `Undo ${last4} Payroll`, 11_000);
      const t3 = line("2026-03-20", `Undo ${last4} Rent`, -1_000);
      fakes[`${last4}-1.csv`] = undoFake(last4, "2026-03-01", "2026-03-15", 10_000, [t1, t2]);
      fakes[`${last4}-2.csv`] = undoFake(last4, "2026-03-10", "2026-03-31", 20_000, [t2, t3]);
    };

    it("restores the previous closing balance when the newest statement is undone", async () => {
      setup("1111");
      const first = await importFile(a, "1111-1.csv");
      const second = await importFile(a, "1111-2.csv");
      expect((await state("1111")).account?.balanceCents).toBe(20_000n);
      await client(a).finance.statementDiscard({ id: second.id });
      const after = await state("1111");
      expect(after.account?.balanceCents).toBe(10_000n);
      // The payroll line is also in the first statement, so it stays; the rent line goes.
      expect(after.txns).toEqual(["Undo 1111 Coffee", "Undo 1111 Payroll"]);
      expect(await prisma.financeStatement.count({ where: { id: second.id } })).toBe(0);
      expect(await prisma.financeStatement.count({ where: { id: first.id } })).toBe(1);
    });

    it("removes the account the import created when its only statement is undone", async () => {
      // Continues from above: the first statement is the only one left for this account.
      const [only] = await prisma.financeStatement.findMany({
        where: { spaceId, institution: "Undo Bank", accountLast4: "1111" },
      });
      await client(a).finance.statementDiscard({ id: only?.id as string });
      expect(await state("1111")).toEqual({ account: null, txns: [] });
    });

    it("removes exactly that statement's own transactions, keeping the balance of the newest", async () => {
      setup("2222");
      const first = await importFile(a, "2222-1.csv");
      await importFile(a, "2222-2.csv");
      await client(a).finance.statementDiscard({ id: first.id });
      const after = await state("2222");
      // Coffee was only in the first statement; Payroll is shared and stays with the second.
      expect(after.txns).toEqual(["Undo 2222 Payroll", "Undo 2222 Rent"]);
      expect(after.account?.balanceCents).toBe(20_000n);
      // Other accounts of the user are untouched.
      expect(
        await prisma.financeAccount.count({ where: { spaceId, userId: userA } }),
      ).toBeGreaterThan(1);
    });

    it("gives another user NOT_FOUND and changes nothing", async () => {
      const mine = (await state("2222")).account;
      const statement = await prisma.financeStatement.findFirstOrThrow({
        where: { spaceId, accountLast4: "2222", status: "imported" },
      });
      await expect(client(b).finance.statementDiscard({ id: statement.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await state("2222")).toMatchObject({
        account: { id: mine?.id },
        txns: expect.any(Array),
      });
      expect((await state("2222")).txns).toHaveLength(2);
    });
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

  describe("identical files, card accounts and balances without a closing line", () => {
    const csv = (desc: string) =>
      `Date,Description,Amount\n2026-05-02,${desc},-5.00\n2026-05-03,${desc} Two,-7.00\n`;
    const importFile = async (who: Actor, name: string, body?: string) => {
      const reviewed = await upload(who, name, body);
      return client(who).finance.statementConfirm({ id: reviewed.id });
    };

    it("refuses the same content under another file name, and keeps different files", async () => {
      const first = await importFile(a, "dupcheck.csv", csv("Dup Alpha"));
      expect(first.status).toBe("imported");
      await expect(upload(a, "dupcheck (1).csv", csv("Dup Alpha"))).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(
        await prisma.financeAccount.count({
          where: { spaceId, userId: userA, name: "dupcheck 1" },
        }),
      ).toBe(0);
      expect(
        await prisma.financeTransaction.count({ where: { spaceId, counterparty: "Dup Alpha" } }),
      ).toBe(1);
      // Different content under a different name is still fine.
      const other = await upload(a, "dupcheck-other.csv", csv("Dup Beta"));
      expect(other.status).toBe("review");
      // Another user may upload the same bytes.
      expect((await upload(b, "dupcheck.csv", csv("Dup Alpha"))).status).toBe("review");
    });

    it("keeps transaction ids the same when only the file-name institution differs", async () => {
      const [x] = await prisma.financeTransaction.findMany({
        where: { spaceId, userId: userA, counterparty: "Dup Alpha" },
      });
      expect(x?.externalId).toMatch(/^h:/);
      const { statementTxnIds } = await import("./finance-statements.js");
      expect(statementTxnIds([line("2026-05-02", "Dup Alpha", -500)])[0]).toBe(x?.externalId);
    });

    it("still matches and undoes transactions stored under legacy (account-keyed) ids", async () => {
      const { statementTxnIds, statementAccountKey } = await import("./finance-statements.js");
      const { createHash } = await import("node:crypto");
      const t1 = line("2026-03-02", "Legacy Coffee", -500);
      const t2 = line("2026-03-10", "Legacy Payroll", 11_000);
      const t3 = line("2026-03-20", "Legacy Rent", -1_000);
      const legacy = (start: string, end: string, closing: number, t: (typeof t1)[]) => {
        const base = fake(start, end, closing, t);
        return {
          ...base,
          statement: { ...base.statement, institution: "Legacy Bank", accountLast4: "8888" },
        };
      };
      fakes["8888-1.csv"] = legacy("2026-03-01", "2026-03-15", 10_000, [t1, t2]);
      fakes["8888-2.csv"] = legacy("2026-03-10", "2026-03-31", 20_000, [t2, t3]);
      const first = await importFile(a, "8888-1.csv");
      // Rewrite the first import's rows the way the old code stored them.
      const stmt = fakes["8888-1.csv"]!.statement;
      const key = statementAccountKey(stmt);
      // The old scheme, written out here: sha256 of "key|date|amount|description|occurrence".
      const oldIds = stmt.transactions.map(
        (t) =>
          `h:${createHash("sha256")
            .update(`${key}|${t.date}|${t.amountCents}|${t.description.toLowerCase()}|0`)
            .digest("hex")
            .slice(0, 32)}`,
      );
      const newIds = statementTxnIds(stmt.transactions);
      for (const [i, id] of newIds.entries()) {
        const { count } = await prisma.financeTransaction.updateMany({
          where: { spaceId, userId: userA, accountExternalId: key, externalId: id },
          data: { externalId: oldIds[i] as string },
        });
        expect(count).toBe(1);
      }
      const reviewed = await upload(a, "8888-2.csv");
      expect(reviewed.duplicateCount).toBe(1);
      const second = await client(a).finance.statementConfirm({ id: reviewed.id });
      expect(second.duplicateCount).toBe(1);
      const names = async () =>
        (
          await prisma.financeTransaction.findMany({
            where: { spaceId, userId: userA, accountExternalId: key },
          })
        )
          .map((t) => t.counterparty)
          .sort();
      expect(await names()).toEqual(["Legacy Coffee", "Legacy Payroll", "Legacy Rent"]);
      // Undo the newest: only Rent goes; the legacy-stored shared Payroll stays.
      await client(a).finance.statementDiscard({ id: second.id });
      expect(await names()).toEqual(["Legacy Coffee", "Legacy Payroll"]);
      // Undo the legacy-imported statement: nothing is left behind.
      await client(a).finance.statementDiscard({ id: first.id });
      expect(await names()).toEqual([]);
    });

    describe("CSVs with no account identity", () => {
      const monthly = (day: string, desc: string, balance: string) =>
        `Date,Description,Amount,Balance\n${day},${desc},-5.00,${balance}\n`;
      const cashCents = async (who: Actor) => (await client(who).finance.overview()).cash.cashCents;

      it("puts monthly exports with dated names on one account, cash at the newest closing", async () => {
        const before = await cashCents(b);
        const july = await importFile(
          b,
          "monthly-2026-07.csv",
          monthly("2026-07-02", "Monthly July", "95.00"),
        );
        const aug = await importFile(
          b,
          "monthly-2026-08.csv",
          monthly("2026-08-02", "Monthly Aug", "90.00"),
        );
        expect(aug.accountId).toBe(july.accountId);
        expect(await cashCents(b)).toBe(before + 9_000);
      });

      it("keeps clearly different stems on separate accounts", async () => {
        const one = await importFile(
          b,
          "stemone-2026-07.csv",
          monthly("2026-07-02", "Stem One", "10.00"),
        );
        const two = await importFile(
          b,
          "stemtwo-2026-07.csv",
          monthly("2026-07-02", "Stem Two", "20.00"),
        );
        expect(two.accountId).not.toBe(one.accountId);
      });

      it("attaches a dated file to an existing account stored under an old raw-stem key", async () => {
        const old = await prisma.financeAccount.create({
          data: {
            spaceId,
            userId: userB,
            mcpServerId: null,
            provider: "statement",
            externalId: "stmt:oldstem-2026-06:account",
            name: "oldstem 2026 06",
            kind: "checking",
            balanceCents: 0n,
            currency: "USD",
          },
        });
        const reviewed = await upload(
          b,
          "oldstem-2026-07.csv",
          monthly("2026-07-02", "Old Stem", "5.00"),
        );
        expect(reviewed).toMatchObject({ createsAccount: false, accountId: old.id });
        const done = await client(b).finance.statementConfirm({ id: reviewed.id });
        expect(done.accountId).toBe(old.id);
        expect(
          await prisma.financeAccount.count({
            where: { spaceId, userId: userB, name: { startsWith: "oldstem" } },
          }),
        ).toBe(1);
      });
    });

    it("imports a card statement as a card, owed and not cash", async () => {
      const before = (await client(a).finance.overview()).cash;
      const ofx = `<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>USD<CCACCTFROM><ACCTID>4111111111119999</ACCTID></CCACCTFROM>
<BANKTRANLIST><DTSTART>20260401</DTSTART><DTEND>20260430</DTEND>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260405<TRNAMT>-30.00<FITID>C1<NAME>Card Shop</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>-30.00</BALAMT><DTASOF>20260430</DTASOF></LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
      await importFile(a, "card.ofx", ofx);
      const account = await prisma.financeAccount.findFirstOrThrow({
        where: { spaceId, userId: userA, lastFour: "9999" },
      });
      expect(account).toMatchObject({ kind: "card", balanceCents: 3000n });
      const after = (await client(a).finance.overview()).cash;
      expect(after.cashCents).toBe(before.cashCents);
      expect(after.cardOwedCents).toBe(3000);
    });

    it("rejects a EUR statement with a readable error", async () => {
      const eur = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>EUR<BANKACCTFROM><ACCTID>1</ACCTID></BANKACCTFROM>
<BANKTRANLIST><STMTTRN><DTPOSTED>20260405<TRNAMT>-3.00<FITID>E1<NAME>Cafe</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
      const failed = await upload(a, "eur.ofx", eur);
      expect(failed).toMatchObject({ status: "failed" });
      expect(failed.error).toContain("USD");
    });

    describe("undo when the remaining statement has no closing balance", () => {
      const nobal = (
        last4: string,
        start: string,
        end: string,
        opening: number | null,
        closing: number | null,
        txns: ParsedStatement["transactions"],
      ) => {
        const base = fake(start, end, closing, txns);
        return {
          ...base,
          statement: {
            ...base.statement,
            institution: "Nobal Bank",
            accountLast4: last4,
            openingBalanceCents: opening,
          },
        };
      };
      const balanceOf = async (last4: string) =>
        (await prisma.financeAccount.findFirstOrThrow({ where: { spaceId, lastFour: last4 } }))
          .balanceCents;

      it("derives it from opening plus lines when possible", async () => {
        fakes["5551-1.csv"] = nobal("5551", "2026-03-01", "2026-03-15", 1_000, null, [
          line("2026-03-02", "Nobal One", -200),
        ]);
        fakes["5551-2.csv"] = nobal("5551", "2026-03-16", "2026-03-31", null, 9_999, [
          line("2026-03-20", "Nobal Two", 500),
        ]);
        await importFile(a, "5551-1.csv");
        const second = await importFile(a, "5551-2.csv");
        expect(await balanceOf("5551")).toBe(9_999n);
        await client(a).finance.statementDiscard({ id: second.id });
        expect(await balanceOf("5551")).toBe(800n);
      });

      it("resets it to zero when nothing is derivable instead of keeping the undone balance", async () => {
        fakes["5552-1.csv"] = nobal("5552", "2026-03-01", "2026-03-15", null, null, [
          line("2026-03-02", "Nobal Three", -200),
        ]);
        fakes["5552-2.csv"] = nobal("5552", "2026-03-16", "2026-03-31", null, 7_777, [
          line("2026-03-20", "Nobal Four", 500),
        ]);
        await importFile(a, "5552-1.csv");
        const second = await importFile(a, "5552-2.csv");
        expect(await balanceOf("5552")).toBe(7_777n);
        await client(a).finance.statementDiscard({ id: second.id });
        expect(await balanceOf("5552")).toBe(0n);
      });
    });
  });
});
