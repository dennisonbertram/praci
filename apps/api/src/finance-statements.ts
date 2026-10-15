import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { loadClassifyContext, loadStatementReminders as loadStatementRemindersFor } from "@rakazo/adapters";
import type {
  Actor,
  FinanceStatement,
  ParsedStatement,
  StatementCheck,
} from "@rakazo/contracts";
import {
  ParsedStatementSchema,
  STATEMENT_EXTENSIONS,
  STATEMENT_MAX_BYTES,
  StatementCheckSchema,
} from "@rakazo/contracts";
import { classify, vendorKey } from "@rakazo/core";
import type { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { FinanceDeps } from "./finance.js";
import { notFound } from "./inbox.js";

// Statements are parsed by an injected function (the parsers live in @rakazo/adapters), checked,
// shown for review, and only then imported. Every read and write is scoped to the actor's space
// and user. File contents are never logged.

/** The parser dependency. Throws when the file cannot be read. */
export type ParseStatement = (
  input: { fileName: string; bytes: Uint8Array },
  /** Whose statement it is, for the model fallback's consent check and usage. */
  scope: { spaceId: string; userId: string },
) => Promise<{ statement: ParsedStatement; check: StatementCheck }>;

const scopeOf = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });
const PROVIDER = "statement";
const LIST_LIMIT = 200;
const FORMATS = { pdf: "pdf", csv: "csv", ofx: "ofx", qfx: "ofx" } as const;

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const slug = (text: string) => norm(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The account a statement belongs to: institution plus last 4 (or the account name without one). */
export const statementAccountKey = (s: Pick<ParsedStatement, "institution" | "accountLast4" | "accountName">) =>
  `stmt:${slug(s.institution)}:${s.accountLast4 ?? (slug(s.accountName ?? "") || "account")}`;

const accountName = (s: ParsedStatement) => {
  const own = s.accountName?.trim();
  const name = !own
    ? s.institution
    : norm(own).startsWith(norm(s.institution))
      ? own
      : `${s.institution} ${own}`;
  return name.slice(0, 200);
};

/**
 * A stable id per line so overlapping statements do not import a line twice: the bank's own id when
 * the file has one, otherwise a hash of (account, date, amount, description, occurrence of that
 * same key within the statement).
 */
export function statementTxnIds(accountKey: string, txns: ParsedStatement["transactions"]): string[] {
  const seen = new Map<string, number>();
  return txns.map((t) => {
    if (t.externalId) return `x:${t.externalId}`;
    const key = [accountKey, t.date, t.amountCents, norm(t.description)].join("|");
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return `h:${createHash("sha256").update(`${key}|${occurrence}`).digest("hex").slice(0, 32)}`;
  });
}

type ListRow = Prisma.FinanceStatementGetPayload<{ omit: { fileBytes: true; parsed: true } }>;

const toStatement = (row: ListRow): FinanceStatement => ({
  id: row.id,
  accountId: row.accountId,
  fileName: row.fileName,
  format: row.format as FinanceStatement["format"],
  status: row.status as FinanceStatement["status"],
  institution: row.institution,
  accountLast4: row.accountLast4,
  periodStart: row.periodStart,
  periodEnd: row.periodEnd,
  openingBalanceCents: row.openingBalanceCents === null ? null : Number(row.openingBalanceCents),
  closingBalanceCents: row.closingBalanceCents === null ? null : Number(row.closingBalanceCents),
  transactionCount: row.transactionCount,
  check: StatementCheckSchema.nullable().catch(null).parse(row.check),
  createsAccount: row.createsAccount,
  duplicateCount: row.duplicateCount,
  warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
  error: row.error,
  uploadedAt: row.uploadedAt.toISOString(),
});

const omitBulk = { fileBytes: true, parsed: true } as const;

async function existingTxnIds(
  prisma: FinanceDeps["prisma"],
  actor: Actor,
  accountKey: string,
): Promise<Set<string>> {
  const rows = await prisma.financeTransaction.findMany({
    where: { ...scopeOf(actor), provider: PROVIDER, accountExternalId: accountKey },
    select: { externalId: true },
  });
  return new Set(rows.map((r) => r.externalId));
}

export async function financeStatementUpload(
  deps: FinanceDeps,
  actor: Actor,
  input: { fileName: string; contentBase64: string },
): Promise<FinanceStatement> {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!(STATEMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ORPCError("BAD_REQUEST", { message: "Upload a PDF, CSV, OFX or QFX file" });
  }
  // Base64 is 4/3 the size; refuse before decoding anything large.
  if (input.contentBase64.length > Math.ceil(STATEMENT_MAX_BYTES / 3) * 4 + 4) {
    throw new ORPCError("PAYLOAD_TOO_LARGE", { message: "The file is too large" });
  }
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (bytes.length === 0) throw new ORPCError("BAD_REQUEST", { message: "The file is empty" });
  if (bytes.length > STATEMENT_MAX_BYTES) {
    throw new ORPCError("PAYLOAD_TOO_LARGE", { message: "The file is too large" });
  }
  if (!deps.parseStatement) {
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Statement import is not available" });
  }
  const base = {
    ...scopeOf(actor),
    fileName: input.fileName.slice(0, 255),
    format: FORMATS[extension as keyof typeof FORMATS],
    fileSha256: createHash("sha256").update(bytes).digest("hex"),
    fileSize: bytes.length,
    fileBytes: bytes,
  };

  let parsed: { statement: ParsedStatement; check: StatementCheck };
  try {
    const result = await deps.parseStatement({ fileName: input.fileName, bytes }, scopeOf(actor));
    parsed = { statement: ParsedStatementSchema.parse(result.statement), check: result.check };
  } catch (error) {
    getLogger().warn("statement parse failed", {
      reason: error instanceof Error ? error.name : "error",
    });
    // Parser errors are written to be shown to the user and never carry file contents.
    const message = error instanceof Error ? error.message : "";
    const row = await deps.prisma.financeStatement.create({
      data: {
        ...base,
        status: "failed",
        warnings: [],
        error: (message || "Could not read this statement").slice(0, 300),
      },
      omit: omitBulk,
    });
    return toStatement(row);
  }

  const { statement, check } = parsed;
  const key = statementAccountKey(statement);
  const account = await deps.prisma.financeAccount.findFirst({
    where: { ...scopeOf(actor), provider: PROVIDER, externalId: key },
    select: { id: true },
  });
  const known = account ? await existingTxnIds(deps.prisma, actor, key) : new Set<string>();
  const duplicateCount = statementTxnIds(key, statement.transactions).filter((id) =>
    known.has(id),
  ).length;
  const row = await deps.prisma.financeStatement.create({
    data: {
      ...base,
      accountId: account?.id ?? null,
      parsed: statement as unknown as Prisma.InputJsonValue,
      status: "review",
      check,
      warnings: statement.warnings,
      institution: statement.institution,
      accountLast4: statement.accountLast4,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      openingBalanceCents: statement.openingBalanceCents,
      closingBalanceCents: statement.closingBalanceCents,
      transactionCount: statement.transactions.length,
      createsAccount: !account,
      duplicateCount,
    },
    omit: omitBulk,
  });
  return toStatement(row);
}

export async function financeStatementConfirm(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string; acceptMismatch?: boolean },
): Promise<FinanceStatement> {
  const scope = scopeOf(actor);
  const found = await deps.prisma.financeStatement.findFirst({
    where: { id: input.id, ...scope },
    select: { id: true, status: true, check: true, parsed: true },
  });
  if (!found) throw notFound();
  if (found.status !== "review") {
    throw new ORPCError("BAD_REQUEST", { message: "This statement was already handled" });
  }
  const check = StatementCheckSchema.nullable().catch(null).parse(found.check);
  if (check?.balances === "mismatch" && !input.acceptMismatch) {
    throw new ORPCError("BAD_REQUEST", { message: "The balances do not match" });
  }
  const statement = ParsedStatementSchema.parse(found.parsed);
  const key = statementAccountKey(statement);
  const ids = statementTxnIds(key, statement.transactions);
  const context = await loadClassifyContext(deps.prisma, scope);
  const now = deps.now?.() ?? new Date();

  const row = await deps.prisma.$transaction(
    async (tx) => {
      // One import per user at a time: two uploads for a new account must not create it twice.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finance-statement:${actor.spaceId}:${actor.userId}`}))`;
      const claimed = await tx.financeStatement.updateMany({
        where: { id: found.id, ...scope, status: "review" },
        data: { status: "imported" },
      });
      if (claimed.count === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "This statement was already handled" });
      }
      const account =
        (await tx.financeAccount.findFirst({
          where: { ...scope, provider: PROVIDER, externalId: key },
        })) ??
        (await tx.financeAccount.create({
          data: {
            ...scope,
            mcpServerId: null,
            provider: PROVIDER,
            externalId: key,
            name: accountName(statement),
            lastFour: statement.accountLast4,
            kind: "checking",
            balanceCents: 0n,
            currency: statement.currency,
          },
        }));
      const known = new Set(
        (
          await tx.financeTransaction.findMany({
            where: { ...scope, provider: PROVIDER, accountExternalId: key },
            select: { externalId: true },
          })
        ).map((r) => r.externalId),
      );
      const fresh = statement.transactions.flatMap((t, i) => {
        const externalId = ids[i] as string;
        if (known.has(externalId)) return [];
        known.add(externalId);
        return [
          {
            ...scope,
            mcpServerId: null,
            provider: PROVIDER,
            externalId,
            accountExternalId: key,
            postedAt: new Date(`${t.date}T00:00:00Z`),
            amountCents: BigInt(t.amountCents),
            currency: statement.currency,
            counterparty: t.description.slice(0, 200),
            vendorKey: vendorKey(t.description),
            status: "posted",
            kind: "statement",
            classification: classify(
              {
                provider: PROVIDER,
                amountCents: t.amountCents,
                counterparty: t.description,
                kind: "statement",
                category: null,
              },
              context,
            ),
            updatedAt: now,
          },
        ];
      });
      if (fresh.length > 0) await tx.financeTransaction.createMany({ data: fresh });
      // The balance is the newest imported statement's closing balance, so history (which undoes
      // later transactions from it) stays right whatever order statements arrive in.
      await tx.financeStatement.update({
        where: { id: found.id },
        data: { accountId: account.id, duplicateCount: statement.transactions.length - fresh.length },
      });
      const newest = await tx.financeStatement.findFirst({
        where: { accountId: account.id, status: "imported" },
        orderBy: [{ periodEnd: "desc" }, { uploadedAt: "desc" }],
        select: { closingBalanceCents: true },
      });
      if (newest?.closingBalanceCents != null) {
        await tx.financeAccount.update({
          where: { id: account.id },
          data: { balanceCents: newest.closingBalanceCents },
        });
      }
      return tx.financeStatement.findFirstOrThrow({ where: { id: found.id }, omit: omitBulk });
    },
    { timeout: 30_000 },
  );
  return toStatement(row);
}

export async function financeStatementDiscard(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string },
): Promise<{ ok: true }> {
  const removed = await deps.prisma.financeStatement.deleteMany({
    where: { id: input.id, ...scopeOf(actor), status: { in: ["review", "failed"] } },
  });
  if (removed.count === 0) throw notFound();
  return { ok: true };
}

/** Statement accounts whose newest imported statement is getting old. */
export const loadStatementReminders = (deps: FinanceDeps, actor: Actor, today: string) =>
  loadStatementRemindersFor(deps.prisma, scopeOf(actor), today);

export async function financeStatements(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.financeStatement.findMany({
    where: scopeOf(actor),
    orderBy: { uploadedAt: "desc" },
    take: LIST_LIMIT,
    omit: omitBulk,
  });
  const today = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
  return {
    statements: rows.map(toStatement),
    reminders: await loadStatementReminders(deps, actor, today),
  };
}
