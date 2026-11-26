import type { CapTableSnapshot, EquityImportResult } from "@rakazo/contracts";
import { Prisma } from "../client.js";
import { toSafe } from "../safes.js";
import type { FundraisingSafeConvertibleTerms } from "./fundraising-safe-terms.js";
import { mapFundraisingSafeTerms } from "./fundraising-safe-terms.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertPostgresBigInt,
  EquityConflictError,
  EquityInputError,
  ensureLedger,
  inTransaction,
  recordTransaction,
  scopeOf,
  toDate,
} from "./ledger.js";
import { getEquityCertificate, getEquityConvertible } from "./securities.js";
import { getEquityPlan } from "./share-classes.js";

/**
 * Copies a cap table snapshot (from Carta, a sheet or a typed-in table) into an empty ledger,
 * once: holders become stakeholders, share-class rows become issued certificates, SAFE and note
 * rows become convertibles, and available option pools become an "Imported plan". Option, ISO,
 * NSO, RSU and warrant holder rows are unsupported. Each imported record records an `import`
 * transaction. Nothing is written back to the snapshot or to Carta.
 */

type Holder = CapTableSnapshot["holders"][number];
type Kind = "convertible" | "option" | "certificate";

const instrumentTokenPatterns = {
  safe: /\bsafes?\b/i,
  note: /\bnotes?\b/i,
  convertible: /\bconvertibles?\b/i,
  option: /\boptions?\b/i,
  iso: /\bisos?\b/i,
  nso: /\bnsos?\b/i,
  rsu: /\brsus?\b/i,
  warrant: /\bwarrants?\b/i,
} as const;
type InstrumentToken = keyof typeof instrumentTokenPatterns;
const hasInstrumentToken = (security: string, token: InstrumentToken) =>
  instrumentTokenPatterns[token].test(security);
const unsupportedInstrumentTokens = ["option", "iso", "nso", "rsu", "warrant"] as const;
const convertibleInstrumentTokens = ["safe", "note", "convertible"] as const;

const kindOf = (security: string): Kind => {
  if (unsupportedInstrumentTokens.some((token) => hasInstrumentToken(security, token)))
    return "option";
  if (convertibleInstrumentTokens.some((token) => hasInstrumentToken(security, token)))
    return "convertible";
  return "certificate";
};

const isPreferred = (name: string) => /preferred|series/i.test(name) && !/common/i.test(name);

/** "Series Seed Preferred" -> "SSP"; "Common" -> "CS"; unique within `taken`. */
function prefixFor(name: string, taken: Set<string>): string {
  const base = /^common/i.test(name)
    ? "CS"
    : (
        name
          .replace(/[^A-Za-z0-9 ]/g, " ")
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => word[0]!.toUpperCase())
          .join("") || "SC"
      ).slice(0, 8);
  let prefix = base;
  for (let n = 2; taken.has(prefix); n++) prefix = `${base}${n}`;
  taken.add(prefix);
  return prefix;
}

function safeInputInteger(value: number, label: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new EquityInputError(`${label} is outside the PostgreSQL BIGINT range`);
  return assertPostgresBigInt(BigInt(value));
}

const sharesToBig = (shares: number | null | undefined) =>
  shares == null ? 0n : safeInputInteger(shares, "Share quantity");

const dollarsToCents = (usd: number | null) => {
  if (usd === null) return 0n;
  if (!Number.isFinite(usd)) throw new EquityInputError("Amount must be finite");
  const cents = new Prisma.Decimal(usd).times(100);
  if (!cents.isInteger()) throw new EquityInputError("Amount must be an exact number of cents");
  return safeInputInteger(Number(cents.toFixed(0)), "Amount");
};

type PreparedSnapshot = {
  holderShares: bigint[];
  holderAmountsCents: bigint[];
  poolShares: bigint;
  issuedByClass: Map<string, bigint>;
  classNames: Map<string, bigint>;
};

function prepareSnapshot(snapshot: CapTableSnapshot): PreparedSnapshot {
  const unsupported = snapshot.holders.find((holder) => kindOf(holder.security) === "option");
  if (unsupported)
    throw new EquityInputError(
      `Cannot import unsupported instrument "${unsupported.security}" for holder "${unsupported.name}"; exercise and legal terms are required`,
    );

  const holderShares = snapshot.holders.map((holder) => sharesToBig(holder.shares));
  const holderAmountsCents = snapshot.holders.map((holder) => dollarsToCents(holder.amountUsd));
  const poolShares = sharesToBig(snapshot.optionPoolAvailable);
  const issuedByClass = new Map<string, bigint>();
  for (const [index, holder] of snapshot.holders.entries())
    if (kindOf(holder.security) === "certificate")
      issuedByClass.set(
        holder.security,
        assertPostgresBigInt((issuedByClass.get(holder.security) ?? 0n) + holderShares[index]!),
      );

  const classNames = new Map<string, bigint>();
  for (const shareClass of snapshot.shareClasses)
    if (kindOf(shareClass.name) === "certificate")
      classNames.set(shareClass.name, sharesToBig(shareClass.shares));
  for (const [name, issued] of issuedByClass)
    classNames.set(name, issued > (classNames.get(name) ?? 0n) ? issued : classNames.get(name)!);
  if (poolShares > 0n && ![...classNames.keys()].some((name) => /^common/i.test(name)))
    classNames.set("Common", 0n);

  return { holderShares, holderAmountsCents, poolShares, issuedByClass, classNames };
}

const normalizedName = (name: string) => name.trim().toLowerCase();
const normalizedEmail = (email: string | null | undefined) => email?.trim().toLowerCase() || null;
const isSnapshotSafe = (security: string) =>
  kindOf(security) === "convertible" &&
  hasInstrumentToken(security, "safe") &&
  !hasInstrumentToken(security, "note");

type LinkedSafe = { id: string; terms: FundraisingSafeConvertibleTerms };

function resolveSafeSources(
  snapshot: CapTableSnapshot,
  holderAmountsCents: bigint[],
  appSafes: Prisma.SafeGetPayload<object>[],
): Map<number, LinkedSafe> {
  const linked = new Map<number, LinkedSafe>();
  const claimed = new Set<string>();

  for (const [index, holder] of snapshot.holders.entries()) {
    if (!isSnapshotSafe(holder.security) || holder.amountUsd === null) continue;
    const amountCents = holderAmountsCents[index]!;
    if (amountCents === 0n) continue;
    const snapshotName = normalizedName(holder.name);
    const snapshotEmail = normalizedEmail(holder.email);
    const candidates = appSafes.filter(
      (safe) =>
        safe.amountCents === amountCents && normalizedName(safe.investorName) === snapshotName,
    );
    if (candidates.length === 0) continue;

    let selected: Prisma.SafeGetPayload<object> | undefined;
    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      const sourceEmail = normalizedEmail(candidate.investorEmail);
      if (snapshotEmail && sourceEmail && snapshotEmail !== sourceEmail) continue;
      selected = candidate;
    } else {
      const exactEmailMatches = snapshotEmail
        ? candidates.filter((safe) => normalizedEmail(safe.investorEmail) === snapshotEmail)
        : [];
      if (exactEmailMatches.length !== 1)
        throw new EquityInputError(`Ambiguous Fundraising SAFE match for holder "${holder.name}"`);
      selected = exactEmailMatches[0]!;
    }

    if (claimed.has(selected.id))
      throw new EquityInputError(
        `Multiple snapshot SAFE rows match Fundraising SAFE "${holder.name}"`,
      );
    claimed.add(selected.id);
    const safe = toSafe(selected);
    if (safe.status !== "funded")
      throw new EquityInputError(`Matched Fundraising SAFE for "${holder.name}" is not funded`);
    const terms = mapFundraisingSafeTerms(selected);
    if (terms.issueDate === null)
      throw new EquityInputError(
        `Matched Fundraising SAFE for "${holder.name}" has no investment date`,
      );
    linked.set(index, { id: selected.id, terms });
  }

  return linked;
}

export const EMPTY_IMPORT: EquityImportResult = {
  stakeholders: 0,
  shareClasses: 0,
  plans: 0,
  certificates: 0,
  convertibles: 0,
  optionGrants: 0,
};

/** True when the ledger holds no stakeholders, classes or securities yet. */
export async function equityLedgerIsEmpty(prisma: EquityDb, actor: EquityScope) {
  const scope = scopeOf(actor);
  const [stakeholders, classes] = await Promise.all([
    prisma.equityStakeholder.count({ where: scope }),
    prisma.equityShareClass.count({ where: scope }),
  ]);
  return stakeholders === 0 && classes === 0;
}

export async function importEquitySnapshot(
  prisma: EquityDb,
  actor: EquityScope,
  snapshot: CapTableSnapshot,
): Promise<EquityImportResult> {
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    // Serialize concurrent imports of one ledger: the second waits, then sees it is not empty.
    const ledger = await tx.equityLedger.update({
      where: { spaceId_userId: scope },
      data: { updatedAt: new Date() },
    });
    if (ledger.importedAt || !(await equityLedgerIsEmpty(tx, scope)))
      throw new EquityConflictError("The cap table already has data");
    const prepared = prepareSnapshot(snapshot);
    const lockedSafeRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "safes"
      WHERE "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
      ORDER BY "id" FOR UPDATE
    `;
    const lockedSafeIds = lockedSafeRows.map((safe) => safe.id);
    const appSafes =
      lockedSafeIds.length > 0
        ? await tx.safe.findMany({
            where: { ...scope, id: { in: lockedSafeIds } },
            orderBy: { id: "asc" },
          })
        : [];
    const linkedSafes = resolveSafeSources(snapshot, prepared.holderAmountsCents, appSafes);
    const result = { ...EMPTY_IMPORT };
    const asOf = snapshot.asOf;
    const issueDate = toDate(asOf);

    // Stakeholders: one per distinct name and email.
    const holderIds = new Map<string, string>();
    const keyOf = (holder: Holder) =>
      `${normalizedName(holder.name)}|${normalizedEmail(holder.email) ?? ""}`;
    for (const holder of snapshot.holders) {
      const key = keyOf(holder);
      if (holderIds.has(key)) continue;
      const organization = holder.organization && holder.organization === holder.name;
      const row = await tx.equityStakeholder.create({
        data: {
          ...scope,
          type: organization ? "organization" : "individual",
          name: holder.name,
          contactEmail: holder.email,
        },
        select: { id: true },
      });
      holderIds.set(key, row.id);
      result.stakeholders++;
    }

    const prefixes = new Set<string>();
    const classes = new Map<string, { id: string; prefix: string; next: number }>();
    for (const [name, shares] of prepared.classNames) {
      const prefix = prefixFor(name, prefixes);
      const issued = prepared.issuedByClass.get(name) ?? 0n;
      const row = await tx.equityShareClass.create({
        data: {
          ...scope,
          name,
          prefix,
          classType: isPreferred(name) ? "preferred" : "common",
          versions: {
            // The nested version takes the class's space, user and ledger.
            create: {
              documentDate: issueDate,
              authorizedShares: shares > issued ? shares : issued,
            },
          },
        },
        select: { id: true },
      });
      classes.set(name, { id: row.id, prefix, next: 1 });
      result.shareClasses++;
    }

    if (prepared.poolShares > 0n) {
      const common = [...classes.entries()].find(([name]) => /^common/i.test(name))?.[1];
      if (!common)
        throw new EquityInputError("An available option pool requires a Common share class");
      const row = await tx.equityPlan.create({
        data: {
          ...scope,
          name: "Imported plan",
          shareClassId: common.id,
          reservedShares: prepared.poolShares,
        },
        select: { id: true },
      });
      result.plans++;
      const after = await getEquityPlan(tx, scope, row.id);
      await recordTransaction(tx, scope, {
        kind: "import",
        effectiveDate: asOf,
        planId: row.id,
        quantity: prepared.poolShares,
        after,
      });
    }

    let convertibleNumber = 1;
    for (const [index, holder] of snapshot.holders.entries()) {
      const stakeholderId = holderIds.get(keyOf(holder))!;
      const kind = kindOf(holder.security);
      if (kind === "certificate") {
        const quantity = prepared.holderShares[index]!;
        if (quantity === 0n) continue;
        const shareClass = classes.get(holder.security)!;
        const row = await tx.equityCertificate.create({
          data: {
            ...scope,
            label: `${shareClass.prefix}-${shareClass.next++}`,
            stakeholderId,
            shareClassId: shareClass.id,
            quantity,
            cashPaidCents: prepared.holderAmountsCents[index]!,
            issueDate,
          },
          select: { id: true },
        });
        result.certificates++;
        const after = await getEquityCertificate(tx, scope, row.id);
        await recordTransaction(tx, scope, {
          kind: "import",
          effectiveDate: after.issueDate,
          certificateId: row.id,
          quantity,
          valueCents: BigInt(after.transactionValueCents),
          after,
        });
      } else if (kind === "convertible") {
        const principalCents = prepared.holderAmountsCents[index]!;
        if (principalCents === 0n) continue;
        const note = hasInstrumentToken(holder.security, "note");
        const linked = linkedSafes.get(index);
        const terms = linked?.terms;
        const row = await tx.equityConvertible.create({
          data: {
            ...scope,
            label: `${note ? "CN" : "SAFE"}-${convertibleNumber++}`,
            stakeholderId,
            kind: note ? "note" : "safe",
            principalCents: terms ? BigInt(terms.principalCents) : principalCents,
            issueDate: toDate(terms?.issueDate ?? asOf),
            sourceSafeId: linked?.id ?? null,
            valuationCapCents:
              terms?.valuationCapCents == null ? null : BigInt(terms.valuationCapCents),
            valuationCapType: terms?.valuationCapType ?? null,
            discountPercent:
              terms?.discountPercent == null ? null : new Prisma.Decimal(terms.discountPercent),
            mfn: terms?.mfn ?? false,
            proRata: terms?.proRata ?? false,
          },
          select: { id: true },
        });
        result.convertibles++;
        const after = await getEquityConvertible(tx, scope, row.id);
        await recordTransaction(tx, scope, {
          kind: "import",
          effectiveDate: after.issueDate,
          convertibleId: row.id,
          valueCents: BigInt(after.principalCents),
          after: linked ? { ...after, sourceSafeId: linked.id } : after,
        });
      }
    }
    await tx.equityLedger.update({
      where: { spaceId_userId: scope },
      data: { importedAt: new Date() },
    });
    return result;
  });
}
