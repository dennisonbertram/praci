import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  loadClassifyContext,
  loadStatementReminders as loadStatementRemindersFor,
  normalizeStem,
} from "@rakazo/adapters";
import type { Actor, FinanceStatement, ParsedStatement, StatementCheck } from "@rakazo/contracts";
import {
  actorScope,
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

const PROVIDER = "statement";
const LIST_LIMIT = 200;
const FORMATS = { pdf: "pdf", csv: "csv", ofx: "ofx", qfx: "ofx" } as const;

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const slug = (text: string) =>
  norm(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The account a statement belongs to: institution plus last 4 (or the account name without one). */
export const statementAccountKey = (
  s: Pick<ParsedStatement, "institution" | "accountLast4" | "accountName">,
) => `stmt:${slug(s.institution)}:${s.accountLast4 ?? (slug(s.accountName ?? "") || "account")}`;

/**
 * The key of the account a statement goes to. Normally `statementAccountKey`. A statement with no
 * account number (its institution may be only a file-name stem) also matches an existing account
 * with no number whose key was made from an older, dated stem ("checking-2026-06"), so monthly
 * exports of one account do not pile up as separate accounts.
 */
async function resolveAccountKey(
  db: { financeAccount: FinanceDeps["prisma"]["financeAccount"] },
  scope: { spaceId: string; userId: string },
  statement: ParsedStatement,
): Promise<string> {
  const key = statementAccountKey(statement);
  if (statement.accountLast4 !== null) return key;
  const candidates = await db.financeAccount.findMany({
    where: { ...scope, provider: PROVIDER, lastFour: null },
    select: { externalId: true },
  });
  if (candidates.some((c) => c.externalId === key)) return key;
  const suffix = key.slice(key.lastIndexOf(":"));
  const wanted = normalizeStem(statement.institution);
  const match = candidates.find((c) => {
    const rest = c.externalId.slice("stmt:".length);
    if (!c.externalId.endsWith(suffix) || !wanted) return false;
    return normalizeStem(rest.slice(0, rest.length - suffix.length)) === wanted;
  });
  return match?.externalId ?? key;
}

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
 * the file has one, otherwise a hash of (date, amount, description, occurrence of that same key
 * within the statement). The account is not part of the hash: ids are only compared within one
 * account, and the institution can come from a file name that changes between uploads.
 */
export function statementTxnIds(
  txns: ParsedStatement["transactions"],
  /** Set only to compute the legacy ids, which hashed the account key in as well. */
  legacyAccountKey?: string,
): string[] {
  const seen = new Map<string, number>();
  return txns.map((t) => {
    if (t.externalId) return `x:${t.externalId}`;
    const key = [
      ...(legacyAccountKey ? [legacyAccountKey] : []),
      t.date,
      t.amountCents,
      norm(t.description),
    ].join("|");
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return `h:${createHash("sha256").update(`${key}|${occurrence}`).digest("hex").slice(0, 32)}`;
  });
}

/** Ids a statement's lines may be stored under: current, and legacy (account key hashed in). */
const knownIdsOf = (statement: ParsedStatement) => [
  ...statementTxnIds(statement.transactions),
  ...statementTxnIds(statement.transactions, statementAccountKey(statement)),
];

/** A card's balance is what is owed; OFX prints it negative. Other accounts keep the printed sign. */
const storedBalance = (kind: string, cents: number | bigint) =>
  BigInt(kind === "card" ? -Number(cents) : cents);

/** The closing balance, or opening plus the lines, or the last running balance; null if none. */
function knownClosing(statement: ParsedStatement): number | null {
  if (statement.closingBalanceCents !== null) return statement.closingBalanceCents;
  if (statement.openingBalanceCents !== null) {
    return statement.transactions.reduce(
      (n, t) => n + t.amountCents,
      statement.openingBalanceCents,
    );
  }
  return statement.transactions.findLast((t) => t.balanceCents !== null)?.balanceCents ?? null;
}

type ListRow = Prisma.FinanceStatementGetPayload<{ omit: { fileBytes: true; parsed: true } }>;

const toStatement = (row: ListRow & { account?: { name: string } | null }): FinanceStatement => ({
  id: row.id,
  accountId: row.accountId,
  ...(row.account ? { accountName: row.account.name } : {}),
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
    where: { ...actorScope(actor), provider: PROVIDER, accountExternalId: accountKey },
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
    ...actorScope(actor),
    fileName: input.fileName.slice(0, 255),
    format: FORMATS[extension as keyof typeof FORMATS],
    fileSha256: createHash("sha256").update(bytes).digest("hex"),
    fileSize: bytes.length,
    fileBytes: bytes,
  };

  const sameFile = await deps.prisma.financeStatement.findFirst({
    where: {
      ...actorScope(actor),
      fileSha256: base.fileSha256,
      status: { in: ["review", "imported"] },
    },
    select: { id: true },
  });
  if (sameFile) {
    throw new ORPCError("BAD_REQUEST", { message: "This file was already uploaded" });
  }

  let parsed: { statement: ParsedStatement; check: StatementCheck };
  try {
    const result = await deps.parseStatement(
      { fileName: input.fileName, bytes },
      actorScope(actor),
    );
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
  const key = await resolveAccountKey(deps.prisma, actorScope(actor), statement);
  const account = await deps.prisma.financeAccount.findFirst({
    where: { ...actorScope(actor), provider: PROVIDER, externalId: key },
    select: { id: true },
  });
  const known = account ? await existingTxnIds(deps.prisma, actor, key) : new Set<string>();
  const legacy = statementTxnIds(statement.transactions, key);
  const duplicateCount = statementTxnIds(statement.transactions).filter(
    (id, i) => known.has(id) || known.has(legacy[i] as string),
  ).length;
  const gap = account ? await continuityWarning(deps, actor, account.id, statement) : null;
  if (gap) statement.warnings.push(gap);
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
    include: { account: { select: { name: true } } },
  });
  return toStatement(row);
}

/** Whole dollars and cents for a warning line, without floating point. */
const dollars = (cents: number) => {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
};

/**
 * Says when this statement's opening balance does not continue from the account's previous
 * statement (or its closing balance from the next one), such as a missing month or a misread file.
 */
async function continuityWarning(
  deps: FinanceDeps,
  actor: Actor,
  accountId: string,
  statement: ParsedStatement,
): Promise<string | null> {
  const { periodStart, periodEnd, openingBalanceCents, closingBalanceCents } = statement;
  const imported = { ...actorScope(actor), accountId, status: "imported" };
  const select = {
    periodStart: true,
    periodEnd: true,
    openingBalanceCents: true,
    closingBalanceCents: true,
  };
  if (periodStart && openingBalanceCents !== null) {
    const before = await deps.prisma.financeStatement.findFirst({
      where: { ...imported, periodEnd: { lt: periodStart } },
      orderBy: { periodEnd: "desc" },
      select,
    });
    if (
      before?.closingBalanceCents != null &&
      Number(before.closingBalanceCents) !== openingBalanceCents
    )
      return `This statement opens at ${dollars(openingBalanceCents)}, but the one before it closed at ${dollars(Number(before.closingBalanceCents))}.`;
  }
  if (periodEnd && closingBalanceCents !== null) {
    const after = await deps.prisma.financeStatement.findFirst({
      where: { ...imported, periodStart: { gt: periodEnd } },
      orderBy: { periodStart: "asc" },
      select,
    });
    if (
      after?.openingBalanceCents != null &&
      Number(after.openingBalanceCents) !== closingBalanceCents
    )
      return `This statement closes at ${dollars(closingBalanceCents)}, but the one after it opens at ${dollars(Number(after.openingBalanceCents))}.`;
  }
  return null;
}

export async function financeStatementConfirm(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string; acceptMismatch?: boolean },
): Promise<FinanceStatement> {
  const scope = actorScope(actor);
  const found = await deps.prisma.financeStatement.findFirst({
    where: { id: input.id, ...scope },
    select: { id: true, status: true, check: true, parsed: true, fileSha256: true },
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
  const ids = statementTxnIds(statement.transactions);
  const kind = statement.accountKind ?? "checking";
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
      const key = await resolveAccountKey(tx, scope, statement);
      const legacyIds = statementTxnIds(statement.transactions, key);
      const sameFile = found.fileSha256
        ? await tx.financeStatement.count({
            where: {
              ...scope,
              fileSha256: found.fileSha256,
              status: "imported",
              id: { not: found.id },
            },
          })
        : 0;
      if (sameFile > 0) {
        throw new ORPCError("BAD_REQUEST", { message: "This file was already imported" });
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
            kind,
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
        if (known.has(externalId) || known.has(legacyIds[i] as string)) return [];
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
        data: {
          accountId: account.id,
          duplicateCount: statement.transactions.length - fresh.length,
        },
      });
      const newest = await tx.financeStatement.findFirst({
        where: { accountId: account.id, status: "imported" },
        orderBy: [{ periodEnd: "desc" }, { uploadedAt: "desc" }],
        select: { closingBalanceCents: true },
      });
      if (newest?.closingBalanceCents != null) {
        await tx.financeAccount.update({
          where: { id: account.id },
          data: { balanceCents: storedBalance(account.kind, newest.closingBalanceCents) },
        });
      }
      return tx.financeStatement.findFirstOrThrow({ where: { id: found.id }, omit: omitBulk });
    },
    { timeout: 30_000 },
  );
  return toStatement(row);
}

/**
 * Removes a statement. One not yet imported is just deleted. An imported one is undone in one
 * transaction: transactions are not linked to their statement, so the ones to delete are this
 * statement's line ids (deterministic, see `statementTxnIds`) that no other imported statement of
 * the account also has. The balance becomes the newest remaining statement's closing balance,
 * and the account goes when no imported statement remains.
 */
/** Renames the caller's own statement account; accounts synced from a bank keep the bank's name. */
export async function financeStatementAccountRename(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string; name: string },
): Promise<{ ok: true }> {
  const renamed = await deps.prisma.financeAccount.updateMany({
    where: { id: input.id, ...actorScope(actor), provider: PROVIDER },
    data: { name: input.name.slice(0, 200) },
  });
  if (renamed.count === 0) throw notFound();
  return { ok: true };
}

export async function financeStatementDiscard(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string },
): Promise<{ ok: true }> {
  const scope = actorScope(actor);
  await deps.prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finance-statement:${actor.spaceId}:${actor.userId}`}))`;
      const found = await tx.financeStatement.findFirst({
        where: { id: input.id, ...scope },
        select: { id: true, status: true, accountId: true, parsed: true },
      });
      if (!found) throw notFound();
      if (found.status === "imported" && found.accountId) {
        const account = await tx.financeAccount.findFirst({
          where: { id: found.accountId, ...scope },
        });
        const others = await tx.financeStatement.findMany({
          where: {
            ...scope,
            accountId: found.accountId,
            status: "imported",
            id: { not: found.id },
          },
          orderBy: [{ periodEnd: "desc" }, { uploadedAt: "desc" }],
          select: { parsed: true },
        });
        if (account) {
          const idsOf = (parsed: unknown) => knownIdsOf(ParsedStatementSchema.parse(parsed));
          const kept = new Set(others.flatMap((o) => (o.parsed ? idsOf(o.parsed) : [])));
          const doomed = idsOf(found.parsed).filter((id) => !kept.has(id));
          await tx.financeTransaction.deleteMany({
            where: {
              ...scope,
              provider: PROVIDER,
              accountExternalId: account.externalId,
              externalId: { in: doomed },
            },
          });
          // The newest remaining statement sets the balance. When it states none, it is derived from
          // its lines; when that is impossible the balance is unknown and the model has no null, so 0.
          const closing = others[0]?.parsed
            ? knownClosing(ParsedStatementSchema.parse(others[0].parsed))
            : null;
          if (others.length === 0) {
            // A statement still in review that pointed at this account will create it again.
            await tx.financeStatement.updateMany({
              where: { ...scope, accountId: account.id, id: { not: found.id } },
              data: { accountId: null, createsAccount: true },
            });
            await tx.financeAccount.deleteMany({ where: { id: account.id, ...scope } });
          } else {
            await tx.financeAccount.update({
              where: { id: account.id },
              data: { balanceCents: storedBalance(account.kind, closing ?? 0) },
            });
          }
        }
      } else if (found.status === "imported") {
        throw notFound();
      }
      await tx.financeStatement.deleteMany({ where: { id: found.id, ...scope } });
    },
    { timeout: 30_000 },
  );
  return { ok: true };
}

/** Statement accounts whose newest imported statement is getting old. */
export const loadStatementReminders = (deps: FinanceDeps, actor: Actor, today: string) =>
  loadStatementRemindersFor(deps.prisma, actorScope(actor), today);

export async function financeStatements(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.financeStatement.findMany({
    where: actorScope(actor),
    orderBy: { uploadedAt: "desc" },
    take: LIST_LIMIT,
    omit: omitBulk,
    include: { account: { select: { name: true } } },
  });
  const today = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
  return {
    statements: rows.map(toStatement),
    reminders: await loadStatementReminders(deps, actor, today),
  };
}
