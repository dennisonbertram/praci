// Cap table totals: outstanding shares, fully diluted shares, per-class, per-plan, per-convertible
// and per-stakeholder rows. Pure functions over the ledger's plain records; counts and cents are
// BigInt and percents are fixed-point strings. Nothing here reads a database.

import { EQUITY_OUTSTANDING_CERTIFICATE_STATUSES } from "@rakazo/contracts";
import type { Fixed } from "./fixed.js";
import { percentOf, SCALE } from "./fixed.js";
import { isRaisedConvertibleOn, raisedCents } from "./views-raised.js";

export type CapClassType = "common" | "preferred";

export type CapClass = {
  id: string;
  name: string;
  classType: CapClassType;
  authorizedShares: bigint;
  conversionRatio?: Fixed;
  seniority?: number;
  pariPassu?: boolean;
};

export type CapCertificate = {
  id: string;
  stakeholderId: string;
  shareClassId: string;
  quantity: bigint;
  status: string;
  issueDate: string;
  /** The day the certificate stopped being outstanding (transfer, conversion, repurchase, cancellation). */
  closedOn?: string | null;
  /** Made by converting a SAFE or note: its principal is counted as raised, not this certificate. */
  fromConvertible?: boolean;
  cashPaidCents: bigint;
  debtCanceledCents?: bigint;
  ipTransferredCents?: bigint;
  otherConsiderationCents?: bigint;
};

export type CapPlan = {
  id: string;
  name: string;
  shareClassId: string;
  reservedShares: bigint;
  /** Dated pool changes (a decrease is negative): lets the table undo the ones after `asOf`. */
  reservedChanges?: readonly { date: string; shares: bigint }[];
};

export type CapOptionGrant = {
  id: string;
  stakeholderId: string;
  planId: string;
  quantity: bigint;
  exercisedQuantity: bigint;
  canceledQuantity: bigint;
  status: string;
  grantDate: string;
  /** Completed exercises, dated: lets the table undo the ones after `asOf`. */
  exercises?: readonly { date: string; quantity: bigint }[];
  /** Cancellations by date; a reversed cancellation is a negative quantity. */
  cancellations?: readonly { date: string; quantity: bigint }[];
};

export type CapConvertible = {
  id: string;
  stakeholderId: string;
  blockId: string | null;
  blockName: string | null;
  principalCents: bigint;
  status: string;
  issueDate: string;
  closedOn?: string | null;
  interestCents?: bigint;
};

export type CapTableInput = {
  classes: readonly CapClass[];
  certificates: readonly CapCertificate[];
  plans: readonly CapPlan[];
  optionGrants: readonly CapOptionGrant[];
  convertibles: readonly CapConvertible[];
  asOf: string;
};

export type CapTableClassRow = {
  shareClassId: string;
  name: string;
  classType: CapClassType;
  authorizedShares: bigint;
  outstandingShares: bigint;
  outstandingPercent: string;
  fullyDilutedShares: bigint;
  fullyDilutedPercent: string;
  amountRaisedCents: bigint;
};

export type CapTablePlanRow = {
  planId: string;
  name: string;
  outstandingShares: bigint;
  availableShares: bigint;
  fullyDilutedPercent: string;
};

export type CapTableConvertibleRow = {
  blockId: string | null;
  name: string;
  principalCents: bigint;
  interestCents: bigint;
  outstandingDebtCents: bigint;
  amountRaisedCents: bigint;
};

export type CapTableStakeholderClassRow = {
  shareClassId: string;
  outstandingShares: bigint;
  fullyDilutedShares: bigint;
};

export type CapTableStakeholderRow = {
  stakeholderId: string;
  outstandingShares: bigint;
  outstandingPercent: string;
  fullyDilutedShares: bigint;
  fullyDilutedPercent: string;
  cashRaisedCents: bigint;
  byClass: CapTableStakeholderClassRow[];
};

export type CapTableTotals = {
  outstandingShares: bigint;
  fullyDilutedShares: bigint;
  commonShares: bigint;
  preferredShares: bigint;
  availablePlanShares: bigint;
  amountRaisedCents: bigint;
};

export type CapTableResult = {
  totals: CapTableTotals;
  classes: CapTableClassRow[];
  plans: CapTablePlanRow[];
  convertibles: CapTableConvertibleRow[];
  stakeholders: CapTableStakeholderRow[];
};

const OUTSTANDING_CERTIFICATE_STATUSES: ReadonlySet<string> = new Set(
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES,
);

/** True when a certificate still counts as issued and outstanding shares. */
export function isOutstandingCertificate(status: string): boolean {
  return OUTSTANDING_CERTIFICATE_STATUSES.has(status);
}

/** True when the certificate was issued by the date and had not yet been closed on it. */
export function isOutstandingOn(
  certificate: { status: string; issueDate: string; closedOn?: string | null },
  asOf: string,
): boolean {
  return (
    certificate.issueDate <= asOf &&
    (isOutstandingCertificate(certificate.status) ||
      (certificate.closedOn != null && certificate.closedOn > asOf))
  );
}

/**
 * A grant's outstanding and exercised shares on the date: today's figures with the dated exercises
 * and cancellations after the date taken back out. A grant not yet made has neither.
 */
export function optionStateAsOf(
  grant: CapOptionGrant,
  asOf: string,
): { outstanding: bigint; exercised: bigint } {
  if (grant.grantDate > asOf) return { outstanding: 0n, exercised: 0n };
  const after = (events: CapOptionGrant["exercises"]) =>
    (events ?? []).reduce((sum, event) => (event.date > asOf ? sum + event.quantity : sum), 0n);
  const exercisedAfter = after(grant.exercises);
  const canceledAfter = after(grant.cancellations);
  const exercised = grant.exercisedQuantity - exercisedAfter;
  const remaining = grant.quantity - exercised - (grant.canceledQuantity - canceledAfter);
  const live = grant.status === "outstanding" || exercisedAfter !== 0n || canceledAfter !== 0n;
  return { outstanding: live && remaining > 0n ? remaining : 0n, exercised };
}

/** The plan's reserve on the date: today's reserve with the dated changes after it taken back out. */
export function reservedSharesAsOf(plan: CapPlan, asOf: string): bigint {
  const after = (plan.reservedChanges ?? []).reduce(
    (sum, change) => (change.date > asOf ? sum + change.shares : sum),
    0n,
  );
  const reserved = plan.reservedShares - after;
  return reserved > 0n ? reserved : 0n;
}

/** Shares counted as converted: floor of shares times the class's conversion ratio. */
export function asConverted(shares: bigint, ratio: bigint | undefined): bigint {
  return ratio === undefined ? shares : (shares * ratio) / SCALE;
}

/** True when the convertible is issued and still open on the date. */
function isOutstandingConvertibleOn(convertible: CapConvertible, asOf: string): boolean {
  return (
    convertible.issueDate <= asOf &&
    (convertible.status === "outstanding" ||
      (convertible.closedOn != null && convertible.closedOn > asOf))
  );
}

/** Quantity less exercised and canceled shares; never below zero. */
export function outstandingOptionQuantity(grant: CapOptionGrant): bigint {
  const remaining = grant.quantity - grant.exercisedQuantity - grant.canceledQuantity;
  return remaining > 0n ? remaining : 0n;
}

/**
 * Shares left in a plan's pool: reserved less the grants still outstanding and the shares already
 * exercised out of the plan. Never below zero.
 */
export function optionPoolAvailable(plan: CapPlan, grants: readonly CapOptionGrant[]): bigint {
  let outstanding = 0n;
  let exercised = 0n;
  for (const grant of grants) {
    if (grant.planId !== plan.id) continue;
    if (grant.status === "outstanding") outstanding += outstandingOptionQuantity(grant);
    exercised += grant.exercisedQuantity;
  }
  const available = plan.reservedShares - outstanding - exercised;
  return available > 0n ? available : 0n;
}

type StakeholderTotals = {
  outstandingShares: bigint;
  optionShares: bigint;
  cashRaisedCents: bigint;
  byClass: Map<string, { outstandingShares: bigint; optionShares: bigint }>;
};

function stakeholderByClass(totals: StakeholderTotals, shareClassId: string) {
  const existing = totals.byClass.get(shareClassId);
  if (existing) return existing;
  const created = { outstandingShares: 0n, optionShares: 0n };
  totals.byClass.set(shareClassId, created);
  return created;
}

/**
 * The cap table as of `asOf`, rebuilt from dated events. Outstanding shares come from certificates
 * issued on or before the date and not yet closed (transferred, converted, repurchased or
 * canceled) on it; options and convertibles are likewise taken as they stood on the date. Fully
 * diluted adds outstanding options and the unissued reserves of every plan, with each class
 * counted at its conversion ratio. Convertibles are debt: they appear as a row but do not count as
 * shares until they convert. Money raised is the one rule in views-raised.ts.
 */
export function computeCapTable(input: CapTableInput): CapTableResult {
  const { asOf } = input;

  const outstandingCertificates = input.certificates.filter((certificate) =>
    isOutstandingOn(certificate, asOf),
  );
  const raised = raisedCents(
    outstandingCertificates,
    input.convertibles.filter((convertible) => isRaisedConvertibleOn(convertible, asOf)),
  );
  const ratioOf = new Map(
    input.classes.map((shareClass) => [shareClass.id, shareClass.conversionRatio]),
  );

  // Per class: outstanding shares.
  const classTotals = new Map<string, { outstandingShares: bigint }>();
  const stakeholderTotals = new Map<string, StakeholderTotals>();
  for (const certificate of outstandingCertificates) {
    const classTotal = classTotals.get(certificate.shareClassId) ?? { outstandingShares: 0n };
    classTotal.outstandingShares += certificate.quantity;
    classTotals.set(certificate.shareClassId, classTotal);

    const holder = stakeholderTotals.get(certificate.stakeholderId) ?? {
      outstandingShares: 0n,
      optionShares: 0n,
      cashRaisedCents: 0n,
      byClass: new Map(),
    };
    holder.outstandingShares += certificate.quantity;
    holder.cashRaisedCents += certificate.cashPaidCents;
    stakeholderByClass(holder, certificate.shareClassId).outstandingShares += certificate.quantity;
    stakeholderTotals.set(certificate.stakeholderId, holder);
  }

  // Per plan: outstanding options as of the date and the pool left to grant.
  const planRows: {
    plan: CapPlan;
    outstandingShares: bigint;
    availableShares: bigint;
  }[] = [];
  const classOptionTotals = new Map<
    string,
    { outstandingShares: bigint; availableShares: bigint }
  >();
  for (const plan of input.plans) {
    let outstandingShares = 0n;
    let exercisedShares = 0n;
    for (const grant of input.optionGrants) {
      if (grant.planId !== plan.id) continue;
      const state = optionStateAsOf(grant, asOf);
      outstandingShares += state.outstanding;
      exercisedShares += state.exercised;
    }
    const pool = reservedSharesAsOf(plan, asOf) - outstandingShares - exercisedShares;
    const availableShares = pool > 0n ? pool : 0n;
    planRows.push({ plan, outstandingShares, availableShares });

    const classTotal = classOptionTotals.get(plan.shareClassId) ?? {
      outstandingShares: 0n,
      availableShares: 0n,
    };
    classTotal.outstandingShares += outstandingShares;
    classTotal.availableShares += availableShares;
    classOptionTotals.set(plan.shareClassId, classTotal);
  }

  // Per stakeholder: their outstanding options, by the class their plan grants in.
  const planClass = new Map(input.plans.map((plan) => [plan.id, plan.shareClassId]));
  for (const grant of input.optionGrants) {
    const quantity = optionStateAsOf(grant, asOf).outstanding;
    if (quantity === 0n) continue;
    const holder = stakeholderTotals.get(grant.stakeholderId) ?? {
      outstandingShares: 0n,
      optionShares: 0n,
      cashRaisedCents: 0n,
      byClass: new Map(),
    };
    holder.optionShares += quantity;
    const shareClassId = planClass.get(grant.planId);
    if (shareClassId !== undefined) {
      stakeholderByClass(holder, shareClassId).optionShares += quantity;
    }
    stakeholderTotals.set(grant.stakeholderId, holder);
  }

  // Convertibles group by block; a convertible without a block is a row of its own.
  const convertibleRows = new Map<string, CapTableConvertibleRow>();
  for (const convertible of input.convertibles) {
    if (!isOutstandingConvertibleOn(convertible, asOf)) continue;
    const key = convertible.blockId ?? "";
    const existing = convertibleRows.get(key);
    const principalCents = convertible.principalCents;
    const interestCents = convertible.interestCents ?? 0n;
    if (existing) {
      existing.principalCents += principalCents;
      existing.interestCents += interestCents;
      existing.outstandingDebtCents += principalCents + interestCents;
      existing.amountRaisedCents += principalCents;
    } else {
      convertibleRows.set(key, {
        blockId: convertible.blockId,
        // A convertible without a block is its own "Convertibles" row.
        name:
          convertible.blockId == null ? "Convertibles" : (convertible.blockName ?? "Convertibles"),
        principalCents,
        interestCents,
        outstandingDebtCents: principalCents + interestCents,
        amountRaisedCents: principalCents,
      });
    }
  }

  const classRows: CapTableClassRow[] = input.classes.map((shareClass) => ({
    shareClassId: shareClass.id,
    name: shareClass.name,
    classType: shareClass.classType,
    authorizedShares: shareClass.authorizedShares,
    outstandingShares: classTotals.get(shareClass.id)?.outstandingShares ?? 0n,
    outstandingPercent: "0.0000",
    fullyDilutedShares: 0n,
    fullyDilutedPercent: "0.0000",
    amountRaisedCents: raised.byClass.get(shareClass.id) ?? 0n,
  }));

  let outstandingShares = 0n;
  let commonShares = 0n;
  let preferredShares = 0n;
  for (const row of classRows) {
    outstandingShares += row.outstandingShares;
    if (row.classType === "preferred") preferredShares += row.outstandingShares;
    else commonShares += row.outstandingShares;
  }

  let availablePlanShares = 0n;
  for (const row of planRows) availablePlanShares += row.availableShares;
  let fullyDilutedShares = 0n;
  for (const row of classRows) {
    const classOptions = classOptionTotals.get(row.shareClassId);
    row.fullyDilutedShares = asConverted(
      row.outstandingShares +
        (classOptions?.outstandingShares ?? 0n) +
        (classOptions?.availableShares ?? 0n),
      ratioOf.get(row.shareClassId),
    );
    fullyDilutedShares += row.fullyDilutedShares;
  }
  for (const row of classRows) {
    row.outstandingPercent = percentOf(row.outstandingShares, outstandingShares, 4);
    row.fullyDilutedPercent = percentOf(row.fullyDilutedShares, fullyDilutedShares, 4);
  }

  // The plan row's percent is the pool's whole footprint: granted and still outstanding plus what
  // is left to grant, the same shares fully diluted counts for the plan.
  const plans: CapTablePlanRow[] = planRows.map(
    ({ plan, outstandingShares: outstanding, availableShares }) => ({
      planId: plan.id,
      name: plan.name,
      outstandingShares: outstanding,
      availableShares,
      fullyDilutedPercent: percentOf(
        asConverted(outstanding + availableShares, ratioOf.get(plan.shareClassId)),
        fullyDilutedShares,
        4,
      ),
    }),
  );

  const classOrder = new Map(input.classes.map((shareClass, index) => [shareClass.id, index]));
  const stakeholders: CapTableStakeholderRow[] = [];
  for (const [stakeholderId, totals] of stakeholderTotals) {
    const byClass = [...totals.byClass.entries()]
      .sort(
        ([a], [b]) =>
          (classOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (classOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
      )
      .map(([shareClassId, classShares]) => ({
        shareClassId,
        outstandingShares: classShares.outstandingShares,
        fullyDilutedShares: asConverted(
          classShares.outstandingShares + classShares.optionShares,
          ratioOf.get(shareClassId),
        ),
      }));
    const fullyDiluted = byClass.reduce((sum, row) => sum + row.fullyDilutedShares, 0n);
    stakeholders.push({
      stakeholderId,
      outstandingShares: totals.outstandingShares,
      outstandingPercent: percentOf(totals.outstandingShares, outstandingShares, 4),
      fullyDilutedShares: fullyDiluted,
      fullyDilutedPercent: percentOf(fullyDiluted, fullyDilutedShares, 4),
      cashRaisedCents: totals.cashRaisedCents,
      byClass,
    });
  }

  return {
    totals: {
      outstandingShares,
      fullyDilutedShares,
      commonShares,
      preferredShares,
      availablePlanShares,
      amountRaisedCents: raised.totalCents,
    },
    classes: classRows,
    plans,
    convertibles: [...convertibleRows.values()],
    stakeholders,
  };
}
