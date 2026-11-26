import type {
  EquityExercise,
  EquityExercisePageSchema,
  EquityOptionGrant,
  EquityOptionGrantPageSchema,
  EquityVestingSchedule as EquityVestingScheduleOutput,
  EquityVestingTemplate,
  EquityVestingTemplatePageSchema,
} from "@rakazo/contracts";
import {
  EquityExerciseCreateInputSchema,
  EquityExerciseListInputSchema,
  EquityExerciseUpdateInputSchema,
  EquityOptionGrantCreateInputSchema,
  EquityOptionGrantListInputSchema,
  EquityOptionGrantUpdateInputSchema,
  EquityVestingTemplateCreateInputSchema,
  EquityVestingTemplateListInputSchema,
  EquityVestingTemplateUpdateInputSchema,
} from "@rakazo/contracts";
import {
  addMonthsClamped,
  describeVesting,
  parseFixed,
  vestedShares,
  vestingRuleOf as wireVestingRuleOf,
} from "@rakazo/core/equity";
import type * as z from "zod";
import { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  assertPostgresBigInt,
  contains,
  defined,
  EquityConflictError,
  EquityInputError,
  ensureLedger,
  fromBig,
  fromDate,
  fromDateOrNull,
  fromDecimal,
  inTransaction,
  iso,
  lockEquityExercises,
  lockEquityLedger,
  lockEquityOptionGrants,
  lockEquityPlans,
  nextLabel,
  notFound,
  pageArgs,
  pageOf,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  toDateOrNull,
  toDecimal,
  today,
  withConflict,
} from "./ledger.js";
import { planAccountingById } from "./plan-accounting.js";
import { keyColumns, replayedId } from "./request-key.js";
import { createEquityExerciseCertificateForPending } from "./securities.js";

type TemplateRow = Prisma.EquityVestingTemplateGetPayload<object>;
type ScheduleRow = Prisma.EquityVestingScheduleGetPayload<object>;
type GrantRow = Prisma.EquityOptionGrantGetPayload<{
  include: {
    stakeholder: { select: { name: true } };
    plan: { select: { name: true } };
    vestingSchedule: true;
  };
}>;
type ExerciseRow = Prisma.EquityExerciseGetPayload<{
  include: { optionGrant: { select: { label: true } } };
}>;

type Tranche = { monthOffset: number; percent: string };

type RuleFields = {
  totalMonths: number;
  cliffMonths?: number | undefined;
  frequencyMonths?: number | undefined;
  tranches?: Tranche[] | null | undefined;
};

const PAYMENT_SCALE = 10_000_000_000n;
const DEFAULT_POST_TERMINATION_MONTHS = 3;

const paymentOf = (quantity: bigint, price: string): bigint =>
  (quantity * parseFixed(price) * 100n + PAYMENT_SCALE / 2n) / PAYMENT_SCALE;

/** 10^10, the scale `parseFixed` uses: percents are compared as scaled BigInt, never floats. */
const HUNDRED = 100n * 10_000_000_000n;

type EquityOptionGrantPage = z.infer<typeof EquityOptionGrantPageSchema>;
type EquityVestingTemplatePage = z.infer<typeof EquityVestingTemplatePageSchema>;
type EquityExercisePage = z.infer<typeof EquityExercisePageSchema>;

/** JSON columns: null is the database NULL, not the JSON literal. */
const jsonValue = (value: Tranche[] | null): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  value === null ? Prisma.DbNull : (value as unknown as Prisma.InputJsonValue);

const jsonTranches = (value: unknown): Tranche[] | null => {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry) => {
    if (entry == null || typeof entry !== "object") return [];
    const { monthOffset, percent } = entry as { monthOffset?: unknown; percent?: unknown };
    if (typeof monthOffset !== "number" || typeof percent !== "string") return [];
    return [{ monthOffset, percent }];
  });
};

function checkRule(rule: RuleFields): void {
  const cliff = rule.cliffMonths ?? 0;
  if (cliff > rule.totalMonths)
    throw new EquityInputError("The cliff cannot be longer than the total vesting period");
  const tranches = rule.tranches ?? null;
  if (tranches && tranches.length > 0) {
    const sum = tranches.reduce((total, tranche) => total + parseFixed(tranche.percent), 0n);
    if (sum !== HUNDRED)
      throw new EquityInputError("Custom tranche percents must sum to exactly 100");
  }
}

const ruleOf = (row: RuleFields) => ({
  totalMonths: row.totalMonths,
  cliffMonths: row.cliffMonths ?? 0,
  frequencyMonths: row.frequencyMonths ?? 1,
  tranches: row.tranches ?? null,
});

// ---- vesting math (replaced by @rakazo/core/equity at merge) ----

function vestingRuleOf(
  schedule: Pick<
    ScheduleRow,
    | "startDate"
    | "totalMonths"
    | "cliffMonths"
    | "frequencyMonths"
    | "tranches"
    | "acceleratedShares"
    | "acceleratedOn"
    | "stoppedOn"
  >,
) {
  return {
    startDate: fromDate(schedule.startDate),
    totalMonths: schedule.totalMonths,
    cliffMonths: schedule.cliffMonths,
    frequencyMonths: schedule.frequencyMonths,
    tranches: jsonTranches(schedule.tranches)?.map((tranche) => ({
      monthOffset: tranche.monthOffset,
      percent: parseFixed(tranche.percent),
    })),
    acceleratedShares: schedule.acceleratedShares,
    acceleratedOn: fromDateOrNull(schedule.acceleratedOn),
    stoppedOn: fromDateOrNull(schedule.stoppedOn),
  };
}

// ---- wire conversions ----

const toTemplate = (row: TemplateRow): EquityVestingTemplate => ({
  id: row.id,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  name: row.name,
  ...ruleOf({
    totalMonths: row.totalMonths,
    cliffMonths: row.cliffMonths,
    frequencyMonths: row.frequencyMonths,
    tranches: jsonTranches(row.tranches),
  }),
});

const toSchedule = (row: ScheduleRow): EquityVestingScheduleOutput => ({
  id: row.id,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  templateId: row.templateId,
  startDate: fromDate(row.startDate),
  ...ruleOf({
    totalMonths: row.totalMonths,
    cliffMonths: row.cliffMonths,
    frequencyMonths: row.frequencyMonths,
    tranches: jsonTranches(row.tranches),
  }),
  acceleratedShares: row.acceleratedShares === null ? null : fromBig(row.acceleratedShares),
  acceleratedOn: fromDateOrNull(row.acceleratedOn),
  stoppedOn: fromDateOrNull(row.stoppedOn),
  description: describeVesting(vestingRuleOf(row)),
});

function toGrant(row: GrantRow): EquityOptionGrant {
  const outstanding = row.quantity - row.exercisedQuantity - row.canceledQuantity;
  const outstandingQuantity = row.status === "outstanding" && outstanding > 0n ? outstanding : 0n;
  const vested = row.vestingSchedule
    ? vestedShares(vestingRuleOf(row.vestingSchedule), row.quantity, today())
    : row.quantity;
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    label: row.label,
    stakeholderId: row.stakeholderId,
    planId: row.planId,
    shareClassId: row.shareClassId,
    status: row.status as EquityOptionGrant["status"],
    optionType: row.optionType as EquityOptionGrant["optionType"],
    quantity: fromBig(row.quantity),
    exercisePrice: fromDecimal(row.exercisePrice),
    grantDate: fromDate(row.grantDate),
    expirationDate: fromDateOrNull(row.expirationDate),
    boardApprovedOn: fromDateOrNull(row.boardApprovedOn),
    postTerminationExerciseMonths: row.postTerminationExerciseMonths,
    earlyExercise: row.earlyExercise,
    acceptanceStatus: row.acceptanceStatus as EquityOptionGrant["acceptanceStatus"],
    canceledOn: fromDateOrNull(row.canceledOn),
    adminNotes: row.adminNotes,
    stakeholderName: row.stakeholder.name,
    planName: row.plan.name,
    exercisedQuantity: fromBig(row.exercisedQuantity),
    canceledQuantity: fromBig(row.canceledQuantity),
    outstandingQuantity: fromBig(outstandingQuantity),
    vestedQuantity: fromBig(vested),
    vestingSchedule: row.vestingSchedule ? toSchedule(row.vestingSchedule) : null,
  };
}

const toExercise = (row: ExerciseRow): EquityExercise => ({
  id: row.id,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  optionGrantId: row.optionGrantId,
  optionGrantLabel: row.optionGrant.label,
  quantity: fromBig(row.quantity),
  exerciseDate: fromDate(row.exerciseDate),
  status: row.status as EquityExercise["status"],
  paymentCents: fromBig(row.paymentCents),
  requestKey: row.requestKey,
  certificateId: row.certificateId,
});

const exerciseAuditSnapshot = (row: ExerciseRow) => ({
  id: row.id,
  optionGrantId: row.optionGrantId,
  requestKey: row.requestKey,
  quantity: fromBig(row.quantity),
  exerciseDate: fromDate(row.exerciseDate),
  status: row.status,
  paymentCents: fromBig(row.paymentCents),
  certificateId: row.certificateId,
});

const grantInclude = {
  stakeholder: { select: { name: true } },
  plan: { select: { name: true } },
  vestingSchedule: true,
} as const;

async function loadGrant(prisma: EquityDb, actor: EquityScope, id: string): Promise<GrantRow> {
  const row = await prisma.equityOptionGrant.findFirst({
    where: { id, ...scopeOf(actor) },
    include: { ...grantInclude },
  });
  if (!row) throw notFound("Option grant");
  return row;
}

async function loadExercise(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<ExerciseRow> {
  const row = await prisma.equityExercise.findFirst({
    where: { id, ...scopeOf(actor) },
    include: { optionGrant: { select: { label: true } } },
  });
  if (!row) throw notFound("Exercise");
  return row;
}

// ---- vesting templates ----

export async function listEquityVestingTemplates(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityVestingTemplateListInputSchema>,
): Promise<EquityVestingTemplatePage> {
  const input = EquityVestingTemplateListInputSchema.parse(raw);
  const where: Prisma.EquityVestingTemplateWhereInput = {
    ...scopeOf(actor),
    ...(input.search ? { name: contains(input.search) } : {}),
  };
  const sort = input.sort ?? { field: "name", dir: "asc" };
  const [rows, total] = await Promise.all([
    prisma.equityVestingTemplate.findMany({
      where,
      orderBy: [{ [sort.field]: sort.dir }, { id: "asc" }],
      ...pageArgs(input),
    }),
    prisma.equityVestingTemplate.count({ where }),
  ]);
  return pageOf(rows.map(toTemplate), total, input);
}

export async function getEquityVestingTemplate(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityVestingTemplate> {
  const row = await prisma.equityVestingTemplate.findFirst({ where: { id, ...scopeOf(actor) } });
  if (!row) throw notFound("Vesting template");
  return toTemplate(row);
}

export async function createEquityVestingTemplate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityVestingTemplateCreateInputSchema>,
): Promise<EquityVestingTemplate> {
  const input = EquityVestingTemplateCreateInputSchema.parse(raw);
  checkRule(input);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const row = await withConflict("A vesting template with this name exists", () =>
      tx.equityVestingTemplate.create({
        data: {
          ...scope,
          name: input.name,
          totalMonths: input.totalMonths,
          cliffMonths: input.cliffMonths ?? 0,
          frequencyMonths: input.frequencyMonths ?? 1,
          tranches: jsonValue(input.tranches ?? null),
        },
      }),
    );
    return toTemplate(row);
  });
}

export async function updateEquityVestingTemplate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityVestingTemplateUpdateInputSchema>,
): Promise<EquityVestingTemplate> {
  const { id, ...input } = EquityVestingTemplateUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const existing = await prisma.equityVestingTemplate.findFirst({ where: { id, ...scope } });
  if (!existing) throw notFound("Vesting template");
  const merged: RuleFields = {
    totalMonths: input.totalMonths ?? existing.totalMonths,
    cliffMonths: input.cliffMonths ?? existing.cliffMonths,
    frequencyMonths: input.frequencyMonths ?? existing.frequencyMonths,
    tranches:
      input.tranches === undefined ? jsonTranches(existing.tranches) : (input.tranches ?? null),
  };
  checkRule(merged);
  const row = await withConflict("A vesting template with this name exists", () =>
    prisma.equityVestingTemplate.update({
      where: { id },
      data: {
        ...defined({
          name: input.name,
          totalMonths: input.totalMonths,
          cliffMonths: input.cliffMonths,
          frequencyMonths: input.frequencyMonths,
          tranches: input.tranches === undefined ? undefined : jsonValue(input.tranches ?? null),
        }),
      },
    }),
  );
  return toTemplate(row);
}

// ---- option grants ----

async function planAvailableShares(
  prisma: EquityDb,
  actor: EquityScope,
  planId: string,
): Promise<bigint> {
  const accounting = (await planAccountingById(prisma, actor, [planId])).get(planId);
  if (!accounting) throw new EquityInputError("Unknown plan");
  return accounting.rawAvailableShares;
}

async function createSchedule(
  prisma: EquityDb,
  actor: EquityScope,
  input: z.output<typeof EquityOptionGrantCreateInputSchema>["vesting"],
): Promise<string | null> {
  if (!input) return null;
  const scope = scopeOf(actor);
  await assertInLedger(prisma, actor, "equityVestingTemplate", input.templateId);
  const template = input.templateId
    ? await prisma.equityVestingTemplate.findFirst({
        where: { id: input.templateId, ...scope },
        select: { totalMonths: true, cliffMonths: true, frequencyMonths: true, tranches: true },
      })
    : null;
  if (input.templateId && !template) throw new EquityInputError("Unknown vesting template");
  if (!input.templateId && input.totalMonths === undefined)
    throw new EquityInputError("A total vesting period or valid template is required");
  const rule: RuleFields = {
    totalMonths: input.totalMonths ?? template?.totalMonths ?? 0,
    cliffMonths: input.cliffMonths ?? template?.cliffMonths ?? 0,
    frequencyMonths: input.frequencyMonths ?? template?.frequencyMonths ?? 1,
    tranches:
      input.tranches !== undefined && input.tranches !== null
        ? input.tranches
        : jsonTranches(template?.tranches),
  };
  checkRule(rule);
  const row = await prisma.equityVestingSchedule.create({
    data: {
      ...scope,
      templateId: input.templateId ?? null,
      startDate: toDate(input.startDate),
      totalMonths: rule.totalMonths,
      cliffMonths: rule.cliffMonths ?? 0,
      frequencyMonths: rule.frequencyMonths ?? 1,
      tranches: jsonValue(rule.tranches ?? null),
      acceleratedShares: input.acceleratedShares == null ? null : toBig(input.acceleratedShares),
      acceleratedOn: toDateOrNull(input.acceleratedOn) ?? null,
      stoppedOn: toDateOrNull(input.stoppedOn) ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

async function checkGrantReferences(
  prisma: EquityDb,
  actor: EquityScope,
  input: { stakeholderId?: string; planId?: string; shareClassId?: string },
): Promise<void> {
  await assertInLedger(prisma, actor, "equityStakeholder", input.stakeholderId);
  await assertInLedger(prisma, actor, "equityPlan", input.planId);
  await assertInLedger(prisma, actor, "equityShareClass", input.shareClassId);
}

export async function listEquityOptionGrants(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityOptionGrantListInputSchema>,
): Promise<EquityOptionGrantPage> {
  const input = EquityOptionGrantListInputSchema.parse(raw);
  const where: Prisma.EquityOptionGrantWhereInput = {
    ...scopeOf(actor),
    ...(input.stakeholderId ? { stakeholderId: input.stakeholderId } : {}),
    ...(input.planId?.length ? { planId: { in: input.planId } } : {}),
    ...(input.status?.length ? { status: { in: input.status } } : {}),
    ...(input.optionType ? { optionType: input.optionType } : {}),
    ...(input.grantedFrom || input.grantedTo
      ? {
          grantDate: {
            ...(input.grantedFrom ? { gte: toDate(input.grantedFrom) } : {}),
            ...(input.grantedTo ? { lte: toDate(input.grantedTo) } : {}),
          },
        }
      : {}),
    ...(input.search
      ? {
          OR: [
            { label: contains(input.search) },
            { stakeholder: { name: contains(input.search) } },
          ],
        }
      : {}),
  };
  const sort = input.sort ?? { field: "grantDate", dir: "desc" };
  const orderBy: Prisma.EquityOptionGrantOrderByWithRelationInput[] =
    sort.field === "stakeholderName"
      ? [{ stakeholder: { name: sort.dir } }, { id: "asc" }]
      : [{ [sort.field]: sort.dir }, { id: "asc" }];
  const [rows, total] = await Promise.all([
    prisma.equityOptionGrant.findMany({
      where,
      orderBy,
      include: { ...grantInclude },
      ...pageArgs(input),
    }),
    prisma.equityOptionGrant.count({ where }),
  ]);
  return pageOf(rows.map(toGrant), total, input);
}

export async function getEquityOptionGrant(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityOptionGrant> {
  return toGrant(await loadGrant(prisma, actor, id));
}

export async function createEquityOptionGrant(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityOptionGrantCreateInputSchema>,
): Promise<EquityOptionGrant> {
  const input = EquityOptionGrantCreateInputSchema.parse(raw);
  if (input.status !== undefined && input.status !== "outstanding")
    throw new EquityInputError("New grants must use the canonical outstanding lifecycle");
  if (input.canceledOn != null)
    throw new EquityInputError("New grants cannot carry a cancellation date");
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    const replay = await replayedId(input, (requestKey) =>
      tx.equityOptionGrant.findFirst({
        where: { ...scope, requestKey },
        select: { id: true, requestHash: true },
      }),
    );
    if (replay) return replay;
    await lockEquityPlans(tx, scope, [input.planId]);
    await checkGrantReferences(tx, scope, input);
    const plan = await tx.equityPlan.findFirst({
      where: { id: input.planId, ...scope },
      select: { shareClassId: true },
    });
    if (!plan) throw new EquityInputError("Unknown plan");
    if (input.shareClassId && input.shareClassId !== plan.shareClassId)
      throw new EquityInputError("The grant share class must match its plan");
    const quantity = toBig(input.quantity);
    const available = await planAvailableShares(tx, scope, input.planId);
    if (quantity > available)
      throw new EquityInputError("The plan does not have that many shares available");
    const label = input.label ?? (await nextLabel(tx, scope, "equityOptionGrant", "ES"));
    const scheduleId = await createSchedule(tx, scope, input.vesting);
    const row = await withConflict("An option grant with this label exists", () =>
      tx.equityOptionGrant.create({
        data: {
          ...scope,
          label,
          stakeholderId: input.stakeholderId,
          planId: input.planId,
          shareClassId: input.shareClassId ?? plan.shareClassId,
          status: input.status ?? "outstanding",
          optionType: input.optionType,
          quantity,
          exercisePrice: toDecimal(input.exercisePrice),
          grantDate: toDate(input.grantDate),
          expirationDate: toDateOrNull(input.expirationDate) ?? null,
          boardApprovedOn: toDateOrNull(input.boardApprovedOn) ?? null,
          postTerminationExerciseMonths: input.postTerminationExerciseMonths ?? null,
          earlyExercise: input.earlyExercise ?? false,
          acceptanceStatus: input.acceptanceStatus ?? "accepted",
          vestingScheduleId: scheduleId,
          canceledOn: toDateOrNull(input.canceledOn) ?? null,
          adminNotes: input.adminNotes ?? null,
          ...keyColumns(input),
        },
        include: { ...grantInclude },
      }),
    );
    const output = toGrant(row);
    await recordTransaction(tx, scope, {
      kind: "issue",
      effectiveDate: input.grantDate,
      optionGrantId: row.id,
      planId: row.planId,
      quantity,
      after: output,
    });
    return row.id;
  });
  return toGrant(await loadGrant(prisma, scope, id));
}

export async function updateEquityOptionGrant(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityOptionGrantUpdateInputSchema>,
): Promise<EquityOptionGrant> {
  const { id, vesting, reason, note, ...input } = EquityOptionGrantUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityOptionGrants(tx, scope, [id]);
    const existing = await tx.equityOptionGrant.findFirst({
      where: { id, ...scope },
      include: { vestingSchedule: true },
    });
    if (!existing) throw notFound("Option grant");
    if (input.status !== undefined && input.status !== existing.status)
      throw new EquityInputError("Use the grant cancellation path to change grant status");
    if (input.canceledOn !== undefined) {
      const requestedCanceledOn = toDateOrNull(input.canceledOn)?.getTime() ?? null;
      const existingCanceledOn = existing.canceledOn?.getTime() ?? null;
      if (requestedCanceledOn !== existingCanceledOn)
        throw new EquityInputError("Use the grant cancellation path to change canceledOn");
    }
    if (existing.status !== "outstanding" && input.quantity !== undefined) {
      if (toBig(input.quantity) !== existing.quantity)
        throw new EquityInputError("A closed grant's quantity cannot change");
    }
    if (
      input.exercisePrice !== undefined &&
      toDecimal(input.exercisePrice).comparedTo(existing.exercisePrice) !== 0
    ) {
      const pending = await tx.equityExercise.findFirst({
        where: { ...scope, optionGrantId: id, status: "pending" },
        select: { id: true },
      });
      if (pending)
        throw new EquityConflictError(
          "Cancel pending exercises before changing the exercise price",
        );
    }
    const before = toGrant(await loadGrant(tx, scope, id));
    await checkGrantReferences(tx, scope, input);
    const planId = input.planId ?? existing.planId;
    await lockEquityPlans(tx, scope, [existing.planId, planId]);
    const plan = await tx.equityPlan.findFirst({
      where: { id: planId, ...scope },
      select: { shareClassId: true },
    });
    if (!plan) throw new EquityInputError("Unknown plan");
    const shareClassId = input.shareClassId ?? existing.shareClassId;
    if (shareClassId !== plan.shareClassId)
      throw new EquityInputError("The grant share class must match its plan");
    const quantity = input.quantity === undefined ? existing.quantity : toBig(input.quantity);
    const pending = await tx.equityExercise.aggregate({
      where: { ...scope, optionGrantId: id, status: "pending" },
      _sum: { quantity: true },
    });
    const pendingQuantity = pending._sum.quantity ?? 0n;
    if (quantity < existing.exercisedQuantity + existing.canceledQuantity + pendingQuantity)
      throw new EquityInputError(
        "The grant quantity cannot be less than exercised, canceled and pending shares",
      );
    const movingPlan = planId !== existing.planId;
    if (movingPlan && (existing.exercisedQuantity > 0n || pendingQuantity > 0n))
      throw new EquityConflictError(
        "A grant with exercises or pending reservations cannot move plans",
      );
    if (input.quantity !== undefined || input.planId !== undefined) {
      const accounting = (await planAccountingById(tx, scope, [planId])).get(planId);
      if (!accounting) throw new EquityInputError("Unknown plan");
      const currentRemainder =
        !movingPlan && existing.status === "outstanding"
          ? existing.quantity - existing.exercisedQuantity - existing.canceledQuantity
          : 0n;
      const available = accounting.rawAvailableShares + currentRemainder;
      const newRemainder =
        existing.status === "outstanding"
          ? quantity - existing.exercisedQuantity - existing.canceledQuantity
          : 0n;
      if (newRemainder > available)
        throw new EquityInputError("The plan does not have that many shares available");
    }
    let scheduleId: string | null | undefined;
    if (vesting === null) scheduleId = null;
    else if (vesting !== undefined) scheduleId = await createSchedule(tx, scope, vesting);
    await withConflict("An option grant with this label exists", () =>
      tx.equityOptionGrant.update({
        where: { id },
        data: {
          ...defined({
            label: input.label,
            stakeholderId: input.stakeholderId,
            planId: input.planId,
            shareClassId: input.shareClassId,
            status: input.status,
            optionType: input.optionType,
            quantity: input.quantity === undefined ? undefined : toBig(input.quantity),
            exercisePrice:
              input.exercisePrice === undefined ? undefined : toDecimal(input.exercisePrice),
            grantDate: input.grantDate === undefined ? undefined : toDate(input.grantDate),
            expirationDate: toDateOrNull(input.expirationDate),
            boardApprovedOn: toDateOrNull(input.boardApprovedOn),
            postTerminationExerciseMonths: input.postTerminationExerciseMonths,
            earlyExercise: input.earlyExercise,
            acceptanceStatus: input.acceptanceStatus,
            canceledOn: toDateOrNull(input.canceledOn),
            adminNotes: input.adminNotes,
          }),
          ...(scheduleId === undefined ? {} : { vestingScheduleId: scheduleId }),
        },
      }),
    );
    if (scheduleId !== undefined && scheduleId !== existing.vestingScheduleId) {
      const afterSchedule = scheduleId
        ? await tx.equityVestingSchedule.findFirst({ where: { id: scheduleId, ...scope } })
        : null;
      await recordTransaction(tx, scope, {
        kind: "vesting_change",
        effectiveDate: afterSchedule
          ? fromDate(afterSchedule.startDate)
          : fromDate(existing.grantDate),
        reason,
        note: note ?? null,
        optionGrantId: id,
        planId: existing.planId,
        quantity: existing.quantity,
        before: existing.vestingSchedule ? toSchedule(existing.vestingSchedule) : null,
        after: afterSchedule ? toSchedule(afterSchedule) : null,
      });
    }
    const after = toGrant(await loadGrant(tx, scope, id));
    await recordTransaction(tx, scope, {
      kind: "modify",
      effectiveDate: today(),
      reason,
      note: note ?? null,
      optionGrantId: id,
      planId: after.planId,
      quantity: toBig(after.quantity),
      before,
      after,
    });
  });
  return toGrant(await loadGrant(prisma, scope, id));
}

// ---- exercises ----

export async function listEquityExercises(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityExerciseListInputSchema>,
): Promise<EquityExercisePage> {
  const input = EquityExerciseListInputSchema.parse(raw);
  const where: Prisma.EquityExerciseWhereInput = {
    ...scopeOf(actor),
    ...(input.optionGrantId ? { optionGrantId: input.optionGrantId } : {}),
    ...(input.status?.length ? { status: { in: input.status } } : {}),
    ...(input.search ? { optionGrant: { label: contains(input.search) } } : {}),
  };
  const sort = input.sort ?? { field: "exerciseDate", dir: "desc" };
  const [rows, total] = await Promise.all([
    prisma.equityExercise.findMany({
      where,
      orderBy: [{ [sort.field]: sort.dir }, { id: "asc" }],
      include: { optionGrant: { select: { label: true } } },
      ...pageArgs(input),
    }),
    prisma.equityExercise.count({ where }),
  ]);
  return pageOf(rows.map(toExercise), total, input);
}

export async function getEquityExercise(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityExercise> {
  return toExercise(await loadExercise(prisma, actor, id));
}

async function assertExerciseEligibility(
  tx: EquityDb,
  scope: EquityScope,
  grant: EquityOptionGrant,
  quantityValue: string,
  exerciseDate: string,
  excludeExerciseId?: string,
): Promise<void> {
  const quantity = toBig(quantityValue);
  if (quantity <= 0n) throw new EquityInputError("Exercise quantity must be positive");
  if (grant.status !== "outstanding")
    throw new EquityInputError("Only an outstanding option grant can be exercised");
  if (exerciseDate < grant.grantDate)
    throw new EquityInputError("The exercise date is before the grant date");

  const holder = await tx.equityStakeholder.findFirst({
    where: { id: grant.stakeholderId, ...scope },
    select: { terminatedAt: true },
  });
  if (!holder) throw new EquityInputError("Unknown option grant holder");
  let deadline = grant.expirationDate;
  const terminatedOn = fromDateOrNull(holder.terminatedAt);
  if (terminatedOn) {
    const terminationDeadline = addMonthsClamped(
      terminatedOn,
      grant.postTerminationExerciseMonths ?? DEFAULT_POST_TERMINATION_MONTHS,
    );
    if (!deadline || terminationDeadline < deadline) deadline = terminationDeadline;
  }
  if (deadline && exerciseDate > deadline)
    throw new EquityInputError("The exercise date is after the grant deadline");

  const pending = await tx.equityExercise.aggregate({
    where: {
      ...scope,
      optionGrantId: grant.id,
      status: "pending",
      ...(excludeExerciseId ? { id: { not: excludeExerciseId } } : {}),
    },
    _sum: { quantity: true },
  });
  const reserved = pending._sum.quantity ?? 0n;
  const exercised = toBig(grant.exercisedQuantity);
  const canceled = toBig(grant.canceledQuantity);
  if (quantity + exercised + canceled + reserved > toBig(grant.quantity))
    throw new EquityInputError("The exercise is larger than the grant's outstanding shares");

  if (!grant.earlyExercise) {
    const vested = grant.vestingSchedule
      ? vestedShares(wireVestingRuleOf(grant.vestingSchedule), toBig(grant.quantity), exerciseDate)
      : toBig(grant.quantity);
    if (quantity + exercised + reserved > vested)
      throw new EquityInputError("The exercise is larger than the vested shares");
  }
}

export async function createEquityExercise(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityExerciseCreateInputSchema>,
): Promise<EquityExercise> {
  const input = EquityExerciseCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    const keyed = await tx.equityExercise.findFirst({
      where: { ...scope, requestKey: input.requestKey },
      select: {
        id: true,
        optionGrantId: true,
        quantity: true,
        exerciseDate: true,
        paymentCents: true,
      },
    });
    if (keyed) {
      if (
        keyed.optionGrantId !== input.optionGrantId ||
        keyed.quantity !== toBig(input.quantity) ||
        fromDate(keyed.exerciseDate) !== input.exerciseDate ||
        (input.paymentCents !== undefined && keyed.paymentCents !== toBig(input.paymentCents))
      )
        throw new EquityConflictError("The exercise request key was reused with different terms");
      return keyed.id;
    }
    await lockEquityOptionGrants(tx, scope, [input.optionGrantId]);
    await assertInLedger(tx, scope, "equityOptionGrant", input.optionGrantId);
    const grant = await getEquityOptionGrant(tx, scope, input.optionGrantId);
    await lockEquityPlans(tx, scope, [grant.planId]);
    await assertExerciseEligibility(tx, scope, grant, input.quantity, input.exerciseDate);
    const paymentCents =
      input.paymentCents === undefined
        ? assertPostgresBigInt(paymentOf(toBig(input.quantity), grant.exercisePrice))
        : toBig(input.paymentCents);
    const row = await tx.equityExercise.create({
      data: {
        ...scope,
        optionGrantId: grant.id,
        quantity: toBig(input.quantity),
        exerciseDate: toDate(input.exerciseDate),
        status: "pending",
        paymentCents,
        requestKey: input.requestKey,
      },
      select: { id: true },
    });
    return row.id;
  });
  return toExercise(await loadExercise(prisma, scope, id));
}

export async function updateEquityExercise(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityExerciseUpdateInputSchema>,
): Promise<EquityExercise> {
  const input = EquityExerciseUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    const hint = await tx.equityExercise.findFirst({
      where: { id: input.id, ...scope },
      select: { optionGrantId: true },
    });
    if (!hint) throw notFound("Exercise");
    await lockEquityOptionGrants(tx, scope, [hint.optionGrantId]);
    await lockEquityExercises(tx, scope, [input.id]);
    const existing = await tx.equityExercise.findFirst({
      where: { id: input.id, ...scope },
      include: { optionGrant: { select: { id: true, label: true } } },
    });
    if (!existing) throw notFound("Exercise");
    const effective = {
      exerciseDate: input.exerciseDate ?? fromDate(existing.exerciseDate),
      paymentCents:
        input.paymentCents === undefined
          ? fromBig(existing.paymentCents)
          : fromBig(toBig(input.paymentCents)),
      status: input.status ?? (existing.status as EquityExercise["status"]),
    };
    const termsChanged =
      effective.exerciseDate !== fromDate(existing.exerciseDate) ||
      effective.paymentCents !== fromBig(existing.paymentCents);
    if (existing.status === "completed") {
      if (termsChanged || (input.status !== undefined && input.status !== "completed"))
        throw new EquityConflictError("A completed exercise cannot change");
      if (!existing.certificateId)
        throw new EquityConflictError("The completed exercise has no linked certificate");
      return;
    }
    if (existing.status === "canceled") {
      if (effective.status === "canceled" && !termsChanged) return;
      throw new EquityConflictError("A closed exercise cannot change");
    }
    const grant = await getEquityOptionGrant(tx, scope, existing.optionGrantId);
    await lockEquityPlans(tx, scope, [grant.planId]);
    if (effective.status === "canceled") {
      if (termsChanged)
        throw new EquityConflictError("Cancel a pending exercise without changing its terms");
      const canceled = await tx.equityExercise.update({
        where: { id: existing.id },
        data: { status: "canceled" },
        include: { optionGrant: { select: { id: true, label: true } } },
      });
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate: today(),
        reason: "pending exercise canceled",
        optionGrantId: grant.id,
        planId: grant.planId,
        quantity: existing.quantity,
        before: { ...grant, exercise: exerciseAuditSnapshot(existing), certificate: null },
        after: { ...grant, exercise: exerciseAuditSnapshot(canceled), certificate: null },
      });
      return;
    }
    if (effective.status === "completed" || termsChanged)
      await assertExerciseEligibility(
        tx,
        scope,
        grant,
        fromBig(existing.quantity),
        effective.exerciseDate,
        existing.id,
      );
    if (effective.status === "completed") {
      if (termsChanged)
        await tx.equityExercise.update({
          where: { id: existing.id },
          data: {
            exerciseDate: toDate(effective.exerciseDate),
            paymentCents: toBig(effective.paymentCents),
          },
        });
      const exercised = toBig(grant.exercisedQuantity) + existing.quantity;
      const remaining = toBig(grant.quantity) - exercised - toBig(grant.canceledQuantity);
      await tx.equityOptionGrant.update({
        where: { id: grant.id },
        data: {
          exercisedQuantity: exercised,
          ...(remaining <= 0n ? { status: "exercised" } : {}),
        },
      });
      const certificate = await createEquityExerciseCertificateForPending(
        tx,
        scope,
        {
          stakeholderId: grant.stakeholderId,
          shareClassId: grant.shareClassId,
          planId: grant.planId,
          quantity: fromBig(existing.quantity),
          pricePerShare: grant.exercisePrice,
          pricePaidPerShare: grant.exercisePrice,
          cashPaidCents: effective.paymentCents,
          issueDate: effective.exerciseDate,
        },
        existing.id,
        grant.id,
      );
      const afterGrant = await getEquityOptionGrant(tx, scope, grant.id);
      const afterExercise = await tx.equityExercise.findFirstOrThrow({
        where: { id: existing.id, ...scope },
        include: { optionGrant: { select: { id: true, label: true } } },
      });
      await recordTransaction(tx, scope, {
        kind: "exercise",
        effectiveDate: effective.exerciseDate,
        optionGrantId: grant.id,
        planId: grant.planId,
        quantity: existing.quantity,
        valueCents: toBig(effective.paymentCents),
        before: { ...grant, exercise: exerciseAuditSnapshot(existing), certificate: null },
        after: {
          ...afterGrant,
          exercise: exerciseAuditSnapshot(afterExercise),
          certificate: {
            id: certificate.id,
            quantity: fromBig(existing.quantity),
            issueDate: effective.exerciseDate,
            shareClassId: grant.shareClassId,
            planId: grant.planId,
            pricePerShare: grant.exercisePrice,
            pricePaidPerShare: grant.exercisePrice,
            cashPaidCents: effective.paymentCents,
          },
        },
      });
      return;
    }
    if (!termsChanged) return;
    const updated = await tx.equityExercise.update({
      where: { id: existing.id },
      data: {
        exerciseDate: toDate(effective.exerciseDate),
        paymentCents: toBig(effective.paymentCents),
      },
      include: { optionGrant: { select: { id: true, label: true } } },
    });
    await recordTransaction(tx, scope, {
      kind: "modify",
      effectiveDate: today(),
      reason: "pending exercise terms updated",
      optionGrantId: grant.id,
      planId: grant.planId,
      quantity: existing.quantity,
      before: { ...grant, exercise: exerciseAuditSnapshot(existing), certificate: null },
      after: { ...grant, exercise: exerciseAuditSnapshot(updated), certificate: null },
    });
  });
  return toExercise(await loadExercise(prisma, scope, input.id));
}
