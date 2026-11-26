import type {
  EquityReport,
  EquityReportFormat,
  EquityReportKind,
  EquityReportRun,
} from "@rakazo/contracts";
import { EquityReportInputSchema, EquityReportRunSchema } from "@rakazo/contracts";
import type { Fixed, VestingRule } from "@rakazo/core/equity";
import {
  considerationCents,
  formatFixed,
  fullyDilutedParts,
  isOutstandingCertificate,
  outstandingOptionQuantity,
  parseFixed,
  percentOf,
  toCsv,
  vestedShares,
} from "@rakazo/core/equity";
import type * as z from "zod";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  ensureLedger,
  fromBig,
  fromDate,
  fromDateOrNull,
  fromDecimalOrNull,
  inTransaction,
  iso,
  scopeOf,
  toBig,
  toDate,
  today,
} from "./ledger.js";
import { equityOverview } from "./overview.js";
import { equityCapTableByStakeholder } from "./views-by-stakeholder.js";
import {
  loadCertificateHistory,
  newMoneyCertificates,
  raisedConvertibles,
} from "./views-raised.js";

/**
 * The report catalog: each report is a table of display-ready strings plus the same table as
 * CSV. Share counts and cents stay integer strings, so a spreadsheet gets exact numbers.
 */

type Column = { key: string; label: string; numeric?: boolean; format?: EquityReportFormat };
type Row = Record<string, string | null>;

const n = (key: string, label: string): Column => ({ key, label, numeric: true, format: "shares" });
const s = (key: string, label: string): Column => ({ key, label });
/** Money: integer cents on the wire, exact dollars in the CSV. */
const c = (key: string, label: string): Column => ({ key, label, numeric: true, format: "cents" });
const price = (key: string, label: string): Column => ({
  key,
  label,
  numeric: true,
  format: "price",
});
const dec = (key: string, label: string): Column => ({
  key,
  label,
  numeric: true,
  format: "decimal",
});
const pct = (key: string, label: string): Column => ({
  key,
  label,
  numeric: true,
  format: "percent",
});
const status = (key: string, label: string): Column => ({ key, label, format: "status" });

/** Cents as an exact dollars string for the CSV, e.g. "123456" -> "1234.56". */
function dollars(cents: string): string {
  const value = toBig(cents);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function report(
  kind: EquityReportKind,
  asOf: string,
  columns: Column[],
  rows: Row[],
): EquityReport {
  return {
    kind,
    asOf,
    columns: columns.map((column) => ({
      ...column,
      numeric: column.numeric ?? false,
      format: column.format ?? "text",
    })),
    rows,
    csv: toCsv(
      columns,
      rows.map((row) => {
        const out: Row = { ...row };
        for (const column of columns)
          if (column.format === "cents" && out[column.key])
            out[column.key] = dollars(out[column.key]!);
        return out;
      }),
    ),
  };
}

type ScheduleRow = {
  startDate: Date;
  totalMonths: number;
  cliffMonths: number;
  frequencyMonths: number;
  tranches: unknown;
  acceleratedShares: bigint | null;
  acceleratedOn: Date | null;
  stoppedOn: Date | null;
};

function ruleOf(schedule: ScheduleRow): VestingRule {
  const tranches = Array.isArray(schedule.tranches)
    ? (schedule.tranches as { monthOffset: number; percent: string }[]).map((tranche) => ({
        monthOffset: tranche.monthOffset,
        percent: parseFixed(String(tranche.percent)),
      }))
    : null;
  return {
    startDate: fromDate(schedule.startDate),
    totalMonths: schedule.totalMonths,
    cliffMonths: schedule.cliffMonths,
    frequencyMonths: schedule.frequencyMonths,
    tranches,
    acceleratedShares: schedule.acceleratedShares,
    acceleratedOn: fromDateOrNull(schedule.acceleratedOn),
    stoppedOn: fromDateOrNull(schedule.stoppedOn),
  };
}

/** The rows behind the money raised, by the one rule in views-raised.ts. */
async function loadRaisedRows(prisma: EquityDb, scope: EquityScope, asOf: string) {
  const where = { ...scopeOf(scope), issueDate: { lte: toDate(asOf) } };
  const holder = { select: { id: true, name: true } };
  const [certificates, convertibles, history] = await Promise.all([
    prisma.equityCertificate.findMany({
      where,
      include: { stakeholder: holder, shareClass: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { label: "asc" }, { id: "asc" }],
    }),
    prisma.equityConvertible.findMany({
      where,
      include: { stakeholder: holder, block: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
    loadCertificateHistory(prisma, scope),
  ]);
  return {
    certificates: newMoneyCertificates(certificates, history, asOf),
    convertibles: raisedConvertibles(convertibles, asOf).map((row) => ({
      ...row,
      name: row.block?.name ?? "Convertibles",
    })),
  };
}

export async function equityReport(
  prisma: EquityDb,
  actor: EquityScope,
  rawInput: unknown,
): Promise<EquityReport> {
  const input = EquityReportInputSchema.parse(rawInput);
  const result = await buildReport(prisma, actor, input);
  if (input.record) {
    const scope = scopeOf(actor);
    await inTransaction(prisma, async (tx) => {
      await ensureLedger(tx, scope);
      await tx.equityReportRun.create({
        data: {
          ...scope,
          kind: input.kind,
          asOf: toDate(result.asOf),
          options: {
            groupBy: input.groupBy,
            fullyDiluted: input.fullyDiluted,
            includeConvertibles: input.includeConvertibles,
          },
        },
      });
    });
  }
  return result;
}

const HISTORY_LIMIT = 50;

/** The caller's latest generated reports, newest first. */
export async function equityReportHistory(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<EquityReportRun[]> {
  const rows = await prisma.equityReportRun.findMany({
    where: scopeOf(actor),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: HISTORY_LIMIT,
  });
  return rows.map((row) => {
    const options = (row.options ?? {}) as Record<string, unknown>;
    return EquityReportRunSchema.parse({
      id: row.id,
      kind: row.kind,
      asOf: fromDate(row.asOf),
      groupBy: options.groupBy === "stakeholder" ? "stakeholder" : "share_class",
      fullyDiluted: options.fullyDiluted !== false,
      includeConvertibles: options.includeConvertibles !== false,
      createdAt: iso(row.createdAt),
    });
  });
}

async function buildReport(
  prisma: EquityDb,
  actor: EquityScope,
  input: z.output<typeof EquityReportInputSchema>,
): Promise<EquityReport> {
  const scope = scopeOf(actor);
  const asOf = input.asOf ?? today();
  const issuedBy = { lte: new Date(`${asOf}T00:00:00.000Z`) };

  switch (input.kind) {
    case "cap_table": {
      // Fully diluted is the overview's own split (issued shares per class, options granted, the
      // pool left to grant), so the report's rows and total match the Overview tab.
      const overview = await equityOverview(prisma, scope, { asOf });
      const parts = fullyDilutedParts(overview);
      const whole = input.fullyDiluted ? parts.total : toBig(overview.totals.outstandingShares);
      const extras = input.fullyDiluted
        ? [
            { name: "Options granted", shares: parts.options },
            { name: "Available for grant", shares: parts.pool },
            { name: "Other", shares: parts.other },
          ].filter((row) => row.shares > 0n)
        : [];
      const raised = await loadRaisedRows(prisma, scope, asOf);
      // With convertibles off the Raised column leaves their principal out and says so, and the
      // Total is the sum of the rows shown; with them on it is the overview's amount raised.
      const raisedColumn = c(
        "raised",
        input.includeConvertibles ? "Raised" : "Raised excluding convertibles",
      );
      const sumRaised = (rows: Row[]) =>
        fromBig(rows.reduce((sum, row) => sum + toBig(row.raised ?? "0"), 0n));
      if (input.groupBy === "stakeholder") {
        const table = await equityCapTableByStakeholder(prisma, scope, { asOf });
        const columns = [
          s("stakeholder", "Stakeholder"),
          ...table.classes.map((row) => n(`class:${row.id}`, row.name)),
          ...(input.fullyDiluted ? [n("options", "Options")] : []),
          n("shares", input.fullyDiluted ? "Fully diluted shares" : "Outstanding shares"),
          pct("percent", "Ownership %"),
          ...(input.includeConvertibles ? [c("convertibles", "Convertibles")] : []),
          raisedColumn,
        ];
        // Raised is what each holder paid in by the money raised rule, so a holder who sold or
        // was repaid still has a row for the money they brought in.
        const raisedBy = new Map<string, { name: string; cents: bigint }>();
        const addRaised = (holder: { id: string; name: string }, cents: bigint) =>
          raisedBy.set(holder.id, {
            name: holder.name,
            cents: (raisedBy.get(holder.id)?.cents ?? 0n) + cents,
          });
        for (const row of raised.certificates) addRaised(row.stakeholder, considerationCents(row));
        if (input.includeConvertibles)
          for (const row of raised.convertibles) addRaised(row.stakeholder, row.principalCents);
        const listed = new Set(table.rows.map((row) => row.stakeholderId));
        const rows: Row[] = table.rows
          .filter(
            (row) =>
              input.includeConvertibles ||
              row.fullyDilutedShares !== "0" ||
              raisedBy.has(row.stakeholderId),
          )
          .map((row) => {
            const shares = input.fullyDiluted ? row.fullyDilutedShares : row.outstandingShares;
            return {
              stakeholder: row.name,
              ...Object.fromEntries(
                table.classes.map((c) => [`class:${c.id}`, row.sharesByClass[c.id] ?? "0"]),
              ),
              options: row.options,
              shares,
              percent: percentOf(toBig(shares), whole),
              convertibles: row.convertiblePrincipalCents,
              raised: fromBig(raisedBy.get(row.stakeholderId)?.cents ?? 0n),
            };
          });
        for (const [id, holder] of raisedBy)
          if (!listed.has(id))
            rows.push({
              stakeholder: holder.name,
              ...Object.fromEntries(table.classes.map((c) => [`class:${c.id}`, "0"])),
              options: "0",
              shares: "0",
              percent: percentOf(0n, whole),
              convertibles: "0",
              raised: fromBig(holder.cents),
            });
        // Granted options already sit on their holders' rows; the pool and anything else
        // counted is unallocated, so it gets a row of its own.
        for (const extra of extras.filter((row) => row.name !== "Options granted"))
          rows.push({
            stakeholder: extra.name,
            shares: fromBig(extra.shares),
            percent: percentOf(extra.shares, whole),
          });
        rows.push({
          stakeholder: "Total",
          ...Object.fromEntries(
            table.classes.map((c) => [`class:${c.id}`, table.totals.sharesByClass[c.id] ?? "0"]),
          ),
          options: table.totals.options,
          shares: fromBig(whole),
          percent: percentOf(whole, whole),
          convertibles: table.totals.convertiblePrincipalCents,
          raised: sumRaised(rows),
        });
        return report("cap_table", asOf, columns, rows);
      }
      const columns = [
        s("name", "Share class"),
        n("authorized", "Authorized shares"),
        n("shares", input.fullyDiluted ? "Fully diluted shares" : "Outstanding shares"),
        pct("percent", "Ownership %"),
        raisedColumn,
      ];
      const rows: Row[] = overview.classes.map((row) => ({
        name: row.name,
        authorized: row.authorizedShares,
        shares: row.outstandingShares,
        percent: percentOf(toBig(row.outstandingShares), whole),
        raised: row.amountRaisedCents,
      }));
      for (const extra of extras)
        rows.push({
          name: extra.name,
          authorized: null,
          shares: fromBig(extra.shares),
          percent: percentOf(extra.shares, whole),
          raised: null,
        });
      if (input.includeConvertibles) {
        for (const block of overview.convertibles)
          rows.push({
            name: block.name,
            authorized: null,
            shares: null,
            percent: null,
            raised: block.amountRaisedCents,
          });
        // Principal of convertibles no longer outstanding is still money raised; the shares a
        // conversion issued are already in their class row and carry no new money.
        const settled = new Map<string, bigint>();
        for (const row of raised.convertibles) {
          if (row.status === "outstanding") continue;
          const name = `${row.name} (${row.status})`;
          settled.set(name, (settled.get(name) ?? 0n) + row.principalCents);
        }
        for (const [name, cents] of settled)
          rows.push({
            name,
            authorized: null,
            shares: null,
            percent: null,
            raised: fromBig(cents),
          });
      }
      rows.push({
        name: "Total",
        authorized: null,
        shares: fromBig(whole),
        percent: percentOf(whole, whole),
        raised: sumRaised(rows),
      });
      return report("cap_table", overview.asOf, columns, rows);
    }
    case "voting_rights": {
      // Votes = outstanding shares x votes per share of the class terms in effect on the date.
      const [classes, certificates] = await Promise.all([
        prisma.equityShareClass.findMany({
          where: scope,
          include: { versions: { orderBy: { documentDate: "desc" } } },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
        prisma.equityCertificate.findMany({
          where: { ...scope, issueDate: issuedBy },
          select: {
            stakeholderId: true,
            shareClassId: true,
            quantity: true,
            status: true,
            stakeholder: { select: { name: true } },
          },
        }),
      ]);
      const votesPerShare = new Map(
        classes.map((row) => {
          const terms =
            row.versions.find((version) => fromDate(version.documentDate) <= asOf) ??
            row.versions.at(-1);
          return [row.id, parseFixed(terms?.votesPerShare?.toFixed(10) ?? "1")] as const;
        }),
      );
      const sharesByClass = new Map<string, bigint>();
      const votesByHolder = new Map<string, { name: string; votes: Fixed }>();
      let totalVotes = 0n as Fixed;
      for (const row of certificates) {
        if (!isOutstandingCertificate(row.status)) continue;
        const votes = (row.quantity * (votesPerShare.get(row.shareClassId) ?? 0n)) as Fixed;
        sharesByClass.set(
          row.shareClassId,
          (sharesByClass.get(row.shareClassId) ?? 0n) + row.quantity,
        );
        const holder = votesByHolder.get(row.stakeholderId) ?? {
          name: row.stakeholder.name,
          votes: 0n,
        };
        holder.votes += votes;
        votesByHolder.set(row.stakeholderId, holder);
        totalVotes += votes;
      }
      const whole = (votes: Fixed) => formatFixed(votes, 0);
      if (input.groupBy === "stakeholder")
        return report(
          "voting_rights",
          asOf,
          [s("stakeholder", "Stakeholder"), n("votes", "Votes"), pct("percent", "Voting %")],
          [...votesByHolder.values()]
            .filter((row) => row.votes > 0n)
            .sort((a, b) =>
              b.votes > a.votes ? 1 : b.votes < a.votes ? -1 : a.name.localeCompare(b.name),
            )
            .map((row) => ({
              stakeholder: row.name,
              votes: whole(row.votes),
              percent: percentOf(row.votes, totalVotes),
            })),
        );
      return report(
        "voting_rights",
        asOf,
        [
          s("shareClass", "Share class"),
          dec("votesPerShare", "Votes per share"),
          n("shares", "Outstanding shares"),
          n("votes", "Total votes"),
          pct("percent", "Voting %"),
        ],
        classes.map((row) => {
          const shares = sharesByClass.get(row.id) ?? 0n;
          const votes = (shares * (votesPerShare.get(row.id) ?? 0n)) as Fixed;
          return {
            shareClass: row.name,
            votesPerShare: formatFixed(votesPerShare.get(row.id) ?? 0n, 4),
            shares: fromBig(shares),
            votes: whole(votes),
            percent: percentOf(votes, totalVotes),
          };
        }),
      );
    }
    case "stakeholder_ledger": {
      const rows = await prisma.equityStakeholder.findMany({
        where: scope,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return report(
        "stakeholder_ledger",
        asOf,
        [
          s("name", "Name"),
          status("type", "Type"),
          s("email", "Email"),
          status("relationship", "Relationship"),
          s("employeeId", "Employee ID"),
          s("terminatedAt", "Terminated"),
        ],
        rows.map((row) => ({
          name: row.name,
          type: row.type,
          email: row.contactEmail ?? row.portfolioEmail,
          relationship: row.relationship,
          employeeId: row.employeeId,
          terminatedAt: row.terminatedAt ? row.terminatedAt.toISOString().slice(0, 10) : null,
        })),
      );
    }
    case "cash_raised": {
      // Only new money, by the money raised rule, so the Total is the overview's amount raised:
      // transfers, splits and conversions moved existing money and are left out, and each
      // SAFE or note counts its principal whatever happened to it since.
      const raised = await loadRaisedRows(prisma, scope, asOf);
      const out: Row[] = [
        ...raised.certificates.map((row) => ({
          security: row.label,
          stakeholder: row.stakeholder.name,
          issueDate: fromDate(row.issueDate),
          cash: fromBig(row.cashPaidCents),
          debt: fromBig(row.debtCanceledCents),
          ip: fromBig(row.ipTransferredCents),
          other: fromBig(row.otherConsiderationCents),
          shares: fromBig(row.quantity),
          raised: fromBig(considerationCents(row)),
        })),
        ...raised.convertibles.map((row) => ({
          security: row.label,
          stakeholder: row.stakeholder.name,
          issueDate: fromDate(row.issueDate),
          cash: null,
          debt: null,
          ip: null,
          other: null,
          shares: null,
          raised: fromBig(row.principalCents),
        })),
      ].sort((a, b) => a.issueDate.localeCompare(b.issueDate));
      out.push({
        security: "Total",
        stakeholder: null,
        issueDate: null,
        cash: null,
        debt: null,
        ip: null,
        other: null,
        shares: null,
        raised: fromBig(out.reduce((sum, row) => sum + toBig(row.raised ?? "0"), 0n)),
      });
      return report(
        "cash_raised",
        asOf,
        [
          s("security", "Security"),
          s("stakeholder", "Stakeholder"),
          s("issueDate", "Issue date"),
          c("cash", "Cash paid"),
          c("debt", "Debt canceled"),
          c("ip", "IP transferred"),
          c("other", "Other consideration"),
          n("shares", "Shares"),
          c("raised", "Raised"),
        ],
        out,
      );
    }
    case "securities_ledger": {
      const rows = await prisma.equityCertificate.findMany({
        where: { ...scope, issueDate: issuedBy },
        include: {
          stakeholder: { select: { name: true } },
          shareClass: { select: { name: true } },
        },
        orderBy: [{ issueDate: "asc" }, { label: "asc" }],
      });
      return report(
        "securities_ledger",
        asOf,
        [
          s("security", "Security"),
          s("stakeholder", "Stakeholder"),
          s("shareClass", "Share class"),
          status("status", "Status"),
          s("issueDate", "Issue date"),
          n("quantity", "Shares"),
          price("price", "Price per share"),
          c("cash", "Cash paid"),
        ],
        rows.map((row) => ({
          security: row.label,
          stakeholder: row.stakeholder.name,
          shareClass: row.shareClass.name,
          status: isOutstandingCertificate(row.status) ? "outstanding" : row.status,
          issueDate: fromDate(row.issueDate),
          quantity: fromBig(row.quantity),
          price: row.pricePerShare ? fromDecimalOrNull(row.pricePerShare) : null,
          cash: fromBig(row.cashPaidCents),
        })),
      );
    }
    case "option_holders":
    case "vesting": {
      const grants = await prisma.equityOptionGrant.findMany({
        where: { ...scope, grantDate: issuedBy },
        include: {
          stakeholder: { select: { name: true } },
          plan: { select: { name: true } },
          vestingSchedule: true,
        },
        orderBy: [{ grantDate: "asc" }, { label: "asc" }],
      });
      const vested = (grant: (typeof grants)[number]) =>
        grant.vestingSchedule
          ? vestedShares(ruleOf(grant.vestingSchedule), grant.quantity, asOf)
          : grant.quantity;
      if (input.kind === "vesting")
        return report(
          "vesting",
          asOf,
          [
            s("grant", "Grant"),
            s("stakeholder", "Stakeholder"),
            s("vestingStart", "Vesting start"),
            s("schedule", "Schedule"),
            n("granted", "Granted"),
            n("vested", "Vested"),
            n("unvested", "Unvested"),
          ],
          grants.map((grant) => {
            const done = vested(grant);
            const schedule = grant.vestingSchedule;
            return {
              grant: grant.label,
              stakeholder: grant.stakeholder.name,
              vestingStart: schedule ? fromDate(schedule.startDate) : null,
              schedule: schedule
                ? `${schedule.totalMonths} months, ${schedule.cliffMonths} month cliff`
                : "Fully vested",
              granted: fromBig(grant.quantity),
              vested: fromBig(done),
              unvested: fromBig(grant.quantity - done),
            };
          }),
        );
      return report(
        "option_holders",
        asOf,
        [
          s("grant", "Grant"),
          s("stakeholder", "Stakeholder"),
          s("plan", "Plan"),
          status("type", "Type"),
          s("grantDate", "Grant date"),
          price("price", "Exercise price"),
          n("granted", "Granted"),
          n("vested", "Vested"),
          n("exercised", "Exercised"),
          n("outstanding", "Outstanding"),
          s("expires", "Expiration"),
        ],
        grants.map((grant) => ({
          grant: grant.label,
          stakeholder: grant.stakeholder.name,
          plan: grant.plan.name,
          type: grant.optionType,
          grantDate: fromDate(grant.grantDate),
          price: fromDecimalOrNull(grant.exercisePrice),
          granted: fromBig(grant.quantity),
          vested: fromBig(vested(grant)),
          exercised: fromBig(grant.exercisedQuantity),
          outstanding:
            grant.status === "outstanding"
              ? fromBig(
                  outstandingOptionQuantity({
                    ...grant,
                    grantDate: fromDate(grant.grantDate),
                  }),
                )
              : "0",
          expires: fromDateOrNull(grant.expirationDate),
        })),
      );
    }
  }
}
