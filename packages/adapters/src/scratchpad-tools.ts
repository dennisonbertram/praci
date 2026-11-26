import type { ScratchpadCategory, ScratchpadChannel } from "@rakazo/contracts";
import {
  cartaAgentSpawnKey,
  companyAgentSpawnKey,
  dataRoomAgentSpawnKey,
  emailCompliance,
  financeAgentSpawnKey,
  gtmAgentSpawnKey,
  investorsAgentSpawnKey,
  isMailThreadAgentSpawnKey,
  legalAgentSpawnKey,
  ScratchpadCategorySchema,
  ScratchpadChannelSchema,
  ScratchpadDateTimeSchema,
} from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "@rakazo/db";

const SCRATCHPAD_STATUSES = ["open", "parked", "done"] as const;
type ScratchpadStatus = (typeof SCRATCHPAD_STATUSES)[number];
type Scope = { spaceId: string; userId: string; botId: string };
type ScratchpadClient = PrismaClient | Prisma.TransactionClient;

export const OPEN_SCRATCHPAD_STATUSES: ScratchpadStatus[] = ["open", "parked"];
export const APPROVALS_BEFORE_AUTO = 3;
export const AUTO_DAILY_CAP = 5;
const GATED_CATEGORIES = new Set<ScratchpadCategory>([
  "public_post",
  "create_account",
  "outbound_email",
]);
const DRAFT_ONLY_CHANNELS = new Set<ScratchpadChannel>(["reddit", "hn", "producthunt"]);
export const EMAIL_COMPLIANCE_ERROR =
  "Add an unsubscribe line and a postal address to the email before approving it.";
const TITLE_MAX = 200;
const NOTES_MAX = 4_000;
const TARGET_MAX = 200;
export const PROOF_MAX = 2_000;
const WAITING_ON_MAX = 200;
const REASON_MAX = 500;
/** Rows one scratchpad_add or scratchpad_update call may touch. */
const SCRATCHPAD_BATCH_MAX = 50;
/** The completion tool keeps its reasons shorter than the user-facing edit API. */
const TOOL_REASON_MAX = 200;
const EFFECT_KEY = /^[^:\s]{1,200}:[^:\s]{1,200}:[a-f0-9]{64}(?::[1-9]\d*)?$/;
const CONSUME_APPROVED_POST_INPUT_KEYS = new Set([
  "spaceId",
  "userId",
  "botId",
  "text",
  "scheduledFor",
  "target",
  "effectKey",
  "now",
]);

/**
 * The agents an email chat may hand a to-do to. A fixed set of the owner's own agents, keyed by
 * area, so a model (or text in an email) can never name an arbitrary bot id.
 */
export const SCRATCHPAD_HANDOFF_AGENTS = {
  carta: cartaAgentSpawnKey,
  finance: financeAgentSpawnKey,
  legal: legalAgentSpawnKey,
  data_room: dataRoomAgentSpawnKey,
  investors: investorsAgentSpawnKey,
  company: companyAgentSpawnKey,
  gtm: gtmAgentSpawnKey,
} as const;

/** `mail-thread:<connectionId>:<threadId>`; connection ids hold no colon. */
function mailThreadOf(spawnKey: string | null | undefined) {
  if (!isMailThreadAgentSpawnKey(spawnKey)) return null;
  const rest = (spawnKey as string).slice("mail-thread:".length);
  const i = rest.indexOf(":");
  return i > 0 ? { connectionId: rest.slice(0, i), threadId: rest.slice(i + 1) } : null;
}

export type ScratchpadToolDeps = {
  prisma: PrismaClient;
};

type ScratchpadRow = {
  id: string;
  spaceId?: string;
  userId?: string;
  botId: string;
  title: string;
  status: string;
  notes: string;
  category?: string | null;
  channel?: string | null;
  target?: string | null;
  scheduledFor?: Date | null;
  proof?: string | null;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  dueAt?: Date | null;
  waitingOn?: string | null;
  resolvedReason?: string | null;
  mailMessageId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function categoryValue(value: unknown): ScratchpadCategory | null {
  const parsed = ScratchpadCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function channelValue(value: unknown): ScratchpadChannel | null {
  const parsed = ScratchpadChannelSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function approvedByValue(value: unknown): "user" | "policy" | null {
  return value === "user" || value === "policy" ? value : null;
}

export function mapScratchpadItem(row: ScratchpadRow) {
  return {
    id: row.id,
    botId: row.botId,
    title: row.title,
    status: coerceScratchpadStatus(row.status),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    category: categoryValue(row.category),
    channel: channelValue(row.channel),
    target: row.target ?? null,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    proof: row.proof ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: approvedByValue(row.approvedBy),
    dueAt: row.dueAt?.toISOString() ?? null,
    waitingOn: row.waitingOn ?? null,
    resolvedReason: row.resolvedReason ?? null,
    mailMessageId: row.mailMessageId ?? null,
  };
}

export function isScratchpadStatus(value: unknown): value is ScratchpadStatus {
  return typeof value === "string" && (SCRATCHPAD_STATUSES as readonly string[]).includes(value);
}

function coerceScratchpadStatus(value: unknown): ScratchpadStatus {
  return isScratchpadStatus(value) ? value : "open";
}

/** For the approval gate, which sees a stored category as text. */
export function isGatedScratchpadCategory(category: string | null): boolean {
  return isGated(categoryValue(category));
}

function isGated(
  category: ScratchpadCategory | null,
): category is "public_post" | "create_account" | "outbound_email" {
  return category !== null && GATED_CATEGORIES.has(category);
}

function parseAbsoluteDateTime(value: unknown): Date | null {
  const parsed = ScratchpadDateTimeSchema.safeParse(value);
  return parsed.success ? new Date(parsed.data) : null;
}

/** A due date is an ISO datetime with offset, or a plain date (end of that day, UTC). */
function parseDueAt(value: unknown): Date | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T23:59:59.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return parseAbsoluteDateTime(value);
}

/** Validates the open-item fields shared by add and update; null clears (update only). */
function openItemFields(input: {
  dueAt?: string | null;
  waitingOn?: string | null;
  resolvedReason?: string | null;
}): { error: string } | { data: Record<string, Date | string | null> } {
  const data: Record<string, Date | string | null> = {};
  if (input.dueAt !== undefined) {
    const dueAt = input.dueAt === null ? null : parseDueAt(input.dueAt);
    if (input.dueAt !== null && !dueAt) {
      return { error: "dueAt must be an ISO date or datetime with timezone." };
    }
    data.dueAt = dueAt;
  }
  if (input.waitingOn !== undefined) {
    const waitingOn = input.waitingOn === null ? null : input.waitingOn.trim() || null;
    if (waitingOn && waitingOn.length > WAITING_ON_MAX) {
      return { error: `waitingOn must be at most ${WAITING_ON_MAX} characters.` };
    }
    data.waitingOn = waitingOn;
  }
  if (input.resolvedReason !== undefined) {
    const reason = input.resolvedReason === null ? null : input.resolvedReason.trim() || null;
    if (reason && reason.length > REASON_MAX) {
      return { error: `reason must be at most ${REASON_MAX} characters.` };
    }
    data.resolvedReason = reason;
  }
  return { data };
}

function emailIsCompliant(body: string): boolean {
  const checks = emailCompliance(body);
  return checks.unsubscribe && checks.postalAddress;
}

function isEffectKey(value: unknown): value is string {
  return typeof value === "string" && value.length <= 300 && EFFECT_KEY.test(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > PROOF_MAX) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isZernioProof(value: unknown): value is string {
  return typeof value === "string" && /^zernio:\S+$/.test(value);
}

function isEmailProof(value: unknown, itemId: string): value is string {
  return typeof value === "string" && value === `gmail:${itemId}`;
}

function isValidActorProof(
  category: ScratchpadCategory | null,
  proof: unknown,
  itemId: string,
  founder: boolean,
): boolean {
  if (category === "public_post") return isHttpUrl(proof);
  if (category === "create_account") return isHttpUrl(proof);
  if (founder && category === "draft") return isHttpUrl(proof);
  if (founder && category === "outbound_email" && isEmailProof(proof, itemId)) return true;
  return false;
}

function canReplaceActorProof(
  category: ScratchpadCategory | null,
  previousProof: string | null,
  nextProof: string,
  itemId: string,
  founder: boolean,
): boolean {
  if (!isValidActorProof(category, nextProof, itemId, founder)) return false;
  // Only server code (gtm-posting) writes effect stamps and zernio: proof; a post's
  // proof may only move from a server-written zernio:<id> to its live URL.
  if (category === "public_post") {
    return isZernioProof(previousProof) && !isEffectKey(previousProof);
  }
  return previousProof === null;
}

function updatedAtAfter(existing: ScratchpadRow, now: Date): Date {
  return new Date(Math.max(now.getTime(), existing.updatedAt.getTime() + 1));
}

function renderedVersion(value: unknown): Date | null {
  return parseAbsoluteDateTime(value);
}

function scopeOf(input: Scope): Scope {
  return { spaceId: input.spaceId, userId: input.userId, botId: input.botId };
}

async function lockScope(tx: ScratchpadClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export async function listScratchpadItems(
  deps: ScratchpadToolDeps,
  input: Scope & {
    status?: ScratchpadStatus;
    includeDone?: boolean;
  },
) {
  const statusFilter = input.status
    ? { status: input.status }
    : input.includeDone
      ? {}
      : { status: { in: OPEN_SCRATCHPAD_STATUSES } };
  const rows = await deps.prisma.scratchpadItem.findMany({
    where: {
      ...scopeOf(input),
      ...statusFilter,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => mapScratchpadItem(row as ScratchpadRow));
}

export async function addScratchpadItemFromTool(
  deps: ScratchpadToolDeps,
  input: Scope & {
    title: string;
    status?: string;
    notes?: string;
    category?: string;
    channel?: string;
    target?: string;
    scheduledFor?: string;
    dueAt?: string;
    waitingOn?: string;
    /** The calling bot's spawn key. An email chat's items are linked to its thread. */
    callerSpawnKey?: string | null;
    /** An area (see SCRATCHPAD_HANDOFF_AGENTS) whose agent should own the item. Email chats only. */
    forAgent?: string;
  },
) {
  if ((input as typeof input & { proof?: unknown }).proof !== undefined) {
    return { error: "proof can only be recorded after an item is created." };
  }
  const title = input.title.trim();
  if (!title) return { error: "title is required." };
  if (title.length > TITLE_MAX) return { error: `title must be at most ${TITLE_MAX} characters.` };
  const notes = (input.notes ?? "").trim();
  if (notes.length > NOTES_MAX) return { error: `notes must be at most ${NOTES_MAX} characters.` };

  let category: ScratchpadCategory | null = null;
  if (input.category !== undefined) {
    category = categoryValue(input.category);
    if (!category) return { error: "category is invalid." };
  }
  let channel: ScratchpadChannel | null = null;
  if (input.channel !== undefined) {
    channel = channelValue(input.channel);
    if (!channel) return { error: "channel is invalid." };
  }
  const target = input.target?.trim();
  if (target !== undefined && target.length > TARGET_MAX) {
    return { error: `target must be at most ${TARGET_MAX} characters.` };
  }
  const scheduledFor =
    input.scheduledFor === undefined ? undefined : parseAbsoluteDateTime(input.scheduledFor);
  if (input.scheduledFor !== undefined && !scheduledFor) {
    return { error: "scheduledFor must be an absolute ISO datetime." };
  }
  const open = openItemFields({ dueAt: input.dueAt, waitingOn: input.waitingOn });
  if ("error" in open) return open;
  if (isGated(category) && channel && DRAFT_ONLY_CHANNELS.has(channel)) {
    return { error: "This channel is draft-only for gated items." };
  }

  let status: ScratchpadStatus = isGated(category) ? "parked" : "open";
  if (input.status !== undefined) {
    if (!isScratchpadStatus(input.status)) {
      return { error: "status must be open, parked, or done." };
    }
    if (isGated(category) && input.status !== "parked") {
      return { error: "Gated items must be created parked." };
    }
    status = input.status;
  }

  // Email chat: link the item to its thread, and optionally hand it to the agent that owns the work.
  const mail = mailThreadOf(input.callerSpawnKey);
  let botId = input.botId;
  let addedTo: string | undefined;
  if (input.forAgent !== undefined) {
    const key = Object.hasOwn(SCRATCHPAD_HANDOFF_AGENTS, input.forAgent)
      ? SCRATCHPAD_HANDOFF_AGENTS[input.forAgent as keyof typeof SCRATCHPAD_HANDOFF_AGENTS]
      : undefined;
    if (!key) return { error: "forAgent is not a known agent." };
    if (!mail) return { error: "forAgent can only be used from an email chat." };
    const owner = await deps.prisma.bot.findFirst({
      where: {
        spaceId: input.spaceId,
        userId: input.userId,
        spawnKey: key(input.userId),
        archivedAt: null,
      },
      select: { id: true, name: true },
    });
    // No such agent in this space: keep the item on the email chat's own bot.
    if (owner) {
      botId = owner.id;
      addedTo = owner.name;
    }
  }
  const message = mail
    ? await deps.prisma.cachedMailMessage.findFirst({
        where: {
          spaceId: input.spaceId,
          userId: input.userId,
          connectionId: mail.connectionId,
          threadId: mail.threadId,
        },
        orderBy: { receivedAt: "desc" },
        select: { providerMessageId: true },
      })
    : null;
  const data = {
    ...scopeOf(input),
    botId,
    title,
    status,
    notes,
    ...(category ? { category } : {}),
    ...(channel ? { channel } : {}),
    ...(target !== undefined ? { target } : {}),
    ...(scheduledFor ? { scheduledFor } : {}),
    ...open.data,
    // A to-do handed to another agent is for the person to act on, so it shows in "Waiting on you".
    ...(addedTo && !open.data.waitingOn ? { waitingOn: "you" } : {}),
    ...(mail && message
      ? {
          mailConnectionId: mail.connectionId,
          mailThreadId: mail.threadId,
          mailMessageId: message.providerMessageId,
        }
      : {}),
  };
  const create = (client: ScratchpadClient) =>
    client.scratchpadItem.create({ data }) as Promise<ScratchpadRow>;
  const result = (item: ScratchpadRow) => ({
    item: mapScratchpadItem(item),
    ...(addedTo ? { addedTo } : {}),
  });

  if (category === "goal" && status !== "done") {
    return deps.prisma.$transaction(async (tx) => {
      await lockScope(tx, `scratchpad:goal:${input.spaceId}:${input.userId}:${botId}`);
      const existing = await tx.scratchpadItem.findFirst({
        where: { ...scopeOf(input), botId, category: "goal", status: { not: "done" } },
      });
      if (existing) return { error: "A non-done goal already exists for this bot." };
      return result(await create(tx));
    });
  }
  try {
    return result(await create(deps.prisma));
  } catch (error) {
    // One open item per bot and mail thread (a partial unique index).
    if ((error as { code?: string }).code === "P2002" && "mailThreadId" in data) {
      return {
        error:
          "That agent already has an open to-do for this email. Update it with scratchpad_update instead.",
      };
    }
    throw error;
  }
}

/**
 * A work list: many plain open rows in one call. Rows carry no category, channel or hand-off, so
 * none is a gated item. A row whose title is already open is left alone, so adding a list twice
 * does not double it.
 */
export async function addScratchpadItemsFromTool(
  deps: ScratchpadToolDeps,
  input: Scope & { items: unknown; callerSpawnKey?: string | null },
) {
  if (mailThreadOf(input.callerSpawnKey)) {
    return { error: "An email chat keeps one to-do per email. Add one item, without items." };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { error: "items must be a list of rows, each with a title." };
  }
  if (input.items.length > SCRATCHPAD_BATCH_MAX) {
    return { error: `items can hold at most ${SCRATCHPAD_BATCH_MAX} rows; add the rest next.` };
  }
  const rows: { title: string; notes: string; open: Record<string, Date | string | null> }[] = [];
  for (const raw of input.items as Record<string, unknown>[]) {
    const title = typeof raw?.title === "string" ? raw.title.trim() : "";
    if (!title) return { error: "Every row needs a title." };
    if (title.length > TITLE_MAX) {
      return { error: `title must be at most ${TITLE_MAX} characters.` };
    }
    const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
    if (notes.length > NOTES_MAX) {
      return { error: `notes must be at most ${NOTES_MAX} characters.` };
    }
    const open = openItemFields({
      ...(raw.dueAt != null ? { dueAt: String(raw.dueAt) } : {}),
      ...(raw.waitingOn != null ? { waitingOn: String(raw.waitingOn) } : {}),
    });
    if ("error" in open) return open;
    rows.push({ title, notes, open: open.data });
  }
  return deps.prisma.$transaction(async (tx) => {
    const existing = await tx.scratchpadItem.findMany({
      where: {
        ...scopeOf(input),
        status: { in: OPEN_SCRATCHPAD_STATUSES },
        title: { in: rows.map((row) => row.title) },
      },
      select: { title: true },
    });
    const taken = new Set(existing.map((row) => row.title));
    const items: { id: string; title: string }[] = [];
    for (const row of rows) {
      if (taken.has(row.title)) continue;
      taken.add(row.title);
      const created = await tx.scratchpadItem.create({
        data: {
          ...scopeOf(input),
          title: row.title,
          notes: row.notes,
          status: "open",
          ...row.open,
        },
      });
      items.push({ id: created.id, title: created.title });
    }
    return { added: items.length, alreadyOpen: existing.length, items };
  });
}

type ScratchpadUpdateInput = Scope & {
  itemId: string;
  title?: string;
  status?: string;
  notes?: string;
  target?: string;
  scheduledFor?: string;
  /** ISO date or datetime; null clears. */
  dueAt?: string | null;
  waitingOn?: string | null;
  resolvedReason?: string | null;
  proof?: string;
};

type FounderScratchpadUpdateInput = ScratchpadUpdateInput & {
  updatedAt?: string;
  reapprove?: boolean;
};

function contentEdit(data: Record<string, unknown>): boolean {
  return ["title", "notes", "target", "scheduledFor"].some((key) => key in data);
}

async function scopedItem(
  client: ScratchpadClient,
  input: Scope & { itemId: string },
): Promise<ScratchpadRow | null> {
  const itemId = input.itemId.trim();
  if (!itemId) return null;
  return (await client.scratchpadItem.findFirst({
    where: { id: itemId, ...scopeOf(input) },
  })) as ScratchpadRow | null;
}

async function applyScratchpadUpdate(
  client: ScratchpadClient,
  existing: ScratchpadRow,
  scope: Scope,
  data: Record<string, unknown>,
  now: Date,
  conflictResult: boolean,
  guardUpdatedAt?: Date,
) {
  const updatedAt = updatedAtAfter(existing, now);
  const result = await client.scratchpadItem.updateMany({
    where: {
      id: existing.id,
      ...scopeOf(scope),
      status: existing.status,
      updatedAt: guardUpdatedAt ?? existing.updatedAt,
      approvedAt: existing.approvedAt ?? null,
      approvedBy: existing.approvedBy ?? null,
      proof: existing.proof ?? null,
    },
    data: { ...data, updatedAt },
  });
  if (result.count !== 1) {
    return conflictResult
      ? { conflict: true as const }
      : { error: "Scratchpad item changed; retry." };
  }
  return { item: mapScratchpadItem({ ...existing, ...data, updatedAt }) };
}

async function updateScratchpadItem(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: FounderScratchpadUpdateInput,
  founder: boolean,
) {
  const itemId = input.itemId.trim();
  if (!itemId) return { error: "itemId is required." };

  if ("category" in input || "channel" in input) {
    return { error: "category and channel can only be set when the item is created." };
  }
  if (input.status !== undefined && !isScratchpadStatus(input.status)) {
    return { error: "status must be open, parked, or done." };
  }
  const requestVersion = renderedVersion(input.updatedAt);
  if (input.updatedAt !== undefined && !requestVersion) {
    return { error: "updatedAt must be an absolute ISO datetime." };
  }
  if (founder && input.reapprove && !requestVersion) {
    return { error: "Re-approve requires the current rendered version." };
  }

  const existing = await scopedItem(deps.prisma, { ...input, itemId });
  if (!existing) return { error: "Scratchpad item not found." };
  const category = categoryValue(existing.category);
  const gated = isGated(category);
  const data: Record<string, unknown> = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: "title cannot be empty." };
    if (title.length > TITLE_MAX)
      return { error: `title must be at most ${TITLE_MAX} characters.` };
    data.title = title;
  }
  if (input.notes !== undefined) {
    const notes = input.notes.trim();
    if (notes.length > NOTES_MAX)
      return { error: `notes must be at most ${NOTES_MAX} characters.` };
    data.notes = notes;
  }
  if (input.target !== undefined) {
    const target = input.target.trim();
    if (target.length > TARGET_MAX)
      return { error: `target must be at most ${TARGET_MAX} characters.` };
    data.target = target;
  }
  if (input.scheduledFor !== undefined) {
    const scheduledFor = parseAbsoluteDateTime(input.scheduledFor);
    if (!scheduledFor) return { error: "scheduledFor must be an absolute ISO datetime." };
    data.scheduledFor = scheduledFor;
  }
  const open = openItemFields(input);
  if ("error" in open) return open;
  Object.assign(data, open.data);
  if (input.proof !== undefined) {
    if (typeof input.proof !== "string" || input.proof.length > PROOF_MAX) {
      return { error: `proof must be at most ${PROOF_MAX} characters.` };
    }
    const existingProof = existing.proof ?? null;
    if (input.proof !== existingProof) {
      if (
        input.status === "parked" ||
        !canReplaceActorProof(category, existingProof, input.proof, existing.id, founder)
      ) {
        return { error: "proof must be valid and cannot replace existing proof." };
      }
      data.proof = input.proof;
    }
  }
  if (input.status !== undefined) data.status = input.status;
  // Reopening drops the old reason unless a new one is given.
  if (
    (input.status === "open" || input.status === "parked") &&
    input.resolvedReason === undefined &&
    existing.status === "done"
  ) {
    data.resolvedReason = null;
  }

  const contentWasEdited = contentEdit(data);
  if (founder && gated && (input.reapprove || (input.status === "open" && !contentWasEdited))) {
    if (!requestVersion) {
      return { error: "Approval requires the current rendered version." };
    }
    if (requestVersion.getTime() !== existing.updatedAt.getTime()) {
      return { conflict: true as const };
    }
  }
  if (founder && input.reapprove) {
    if (
      !gated ||
      !isEffectKey(existing.proof) ||
      (existing.status !== "parked" && existing.status !== "open") ||
      contentWasEdited ||
      (input.status !== undefined && input.status !== "open") ||
      input.proof !== undefined
    ) {
      return { error: "Re-approve requires the current version of an uncertain post stamp." };
    }
    const inFlight = await deps.prisma.externalEffect.findUnique({
      where: { idempotencyKey: existing.proof },
      select: { spaceId: true, status: true },
    });
    // ponytail: 10 minutes is a fixed ceiling (dispatch takes seconds); a crashed attempt
    // that left no terminal effect becomes re-approvable after it. Tune if dispatch slows.
    const stale = (deps.now?.() ?? new Date()).getTime() - existing.updatedAt.getTime() > 600_000;
    const status = inFlight
      ? inFlight.spaceId === input.spaceId
        ? inFlight.status
        : "other"
      : null;
    const settled = status === "uncertain" || status === "failed";
    if (!settled && !((status === null || status === "intended") && stale)) {
      return { error: "This post is still being sent; try again shortly." };
    }
    return applyScratchpadUpdate(
      deps.prisma,
      existing,
      input,
      {
        status: "open",
        proof: null,
        approvedAt: deps.now?.() ?? new Date(),
        approvedBy: "user",
      },
      deps.now?.() ?? new Date(),
      true,
      requestVersion ?? undefined,
    );
  }

  if (
    !founder &&
    category === "create_account" &&
    existing.channel === "directory" &&
    input.status === "open"
  ) {
    if (contentWasEdited || data.proof !== undefined || input.reapprove) {
      return { error: "Directory approval requires an unchanged parked item." };
    }
    return approveDirectoryItem(deps, input, existing, false);
  }
  if (!founder && gated && input.status === "open") {
    return { error: "Agents cannot open gated items." };
  }
  if (
    gated &&
    input.status === "open" &&
    founder &&
    !(existing.status === "open" && existing.approvedAt && contentWasEdited)
  ) {
    if (
      existing.status !== "parked" ||
      existing.approvedAt !== null ||
      isEffectKey(existing.proof) ||
      !requestVersion ||
      contentWasEdited ||
      data.proof !== undefined
    ) {
      return { error: "Approval requires the current parked, unapproved version." };
    }
    if (category === "create_account" && existing.channel === "directory") {
      return approveDirectoryItem(deps, input, existing, true);
    }
    if (category === "outbound_email" && !emailIsCompliant(existing.notes)) {
      return { error: EMAIL_COMPLIANCE_ERROR };
    }
    return applyScratchpadUpdate(
      deps.prisma,
      existing,
      input,
      {
        status: "open",
        approvedAt: deps.now?.() ?? new Date(),
        approvedBy: "user",
      },
      deps.now?.() ?? new Date(),
      true,
      requestVersion ?? undefined,
    );
  }

  if (gated && input.status === "done") {
    const proof = data.proof ?? existing.proof;
    const hasCompletionProof =
      category === "outbound_email" ? isEmailProof(proof, existing.id) : isHttpUrl(proof);
    if (!hasCompletionProof) {
      return { error: "A valid proof is required to complete this item." };
    }
    if (category === "outbound_email") {
      const sent = await deps.prisma.composeSend.findUnique({
        where: {
          spaceId_userId_clientId: {
            spaceId: input.spaceId,
            userId: input.userId,
            clientId: existing.id,
          },
        },
        select: { state: true },
      });
      if (sent?.state !== "sent" && sent?.state !== "unknown") {
        return { error: "A sent email is required to complete this item." };
      }
    }
    if (!founder && (existing.status !== "open" || !existing.approvedAt)) {
      return { error: "A gated item must be approved and open before an agent can complete it." };
    }
  }

  if (gated && existing.status === "open" && existing.approvedAt && input.status === "parked") {
    const onlyReasonNote =
      Object.keys(data).every((key) => key === "status" || key === "notes") &&
      (founder || input.status === "parked");
    if (!founder && contentWasEdited && !onlyReasonNote) {
      return { error: "Approved item content is frozen until it is re-parked." };
    }
    data.status = "parked";
    data.approvedAt = null;
    data.approvedBy = null;
  } else if (gated && !founder && existing.approvedAt && contentWasEdited) {
    return { error: "Approved item content is frozen until it is re-parked." };
  }
  if (gated && founder && existing.approvedAt && contentWasEdited) {
    if (input.status === "done") {
      return { error: "Edit the approved item before completing it." };
    }
    data.status = "parked";
    data.approvedAt = null;
    data.approvedBy = null;
  }
  if (
    gated &&
    !founder &&
    existing.status === "done" &&
    input.status !== undefined &&
    input.status !== "done"
  ) {
    return { error: "Completed gated items cannot be reopened by an agent." };
  }
  if (Object.keys(data).length === 0) {
    return {
      error:
        "Provide title, status, notes, target, scheduledFor, dueAt, waitingOn, and/or proof to update.",
    };
  }

  const reopenGoal =
    category === "goal" &&
    existing.status === "done" &&
    (data.status === "open" || data.status === "parked");
  if (reopenGoal) {
    return deps.prisma.$transaction(async (tx) => {
      await lockScope(tx, `scratchpad:goal:${input.spaceId}:${input.userId}:${input.botId}`);
      const otherGoal = await tx.scratchpadItem.findFirst({
        where: {
          ...scopeOf(input),
          category: "goal",
          status: { not: "done" },
          id: { not: existing.id },
        },
      });
      if (otherGoal) return { error: "A non-done goal already exists for this bot." };
      return applyScratchpadUpdate(tx, existing, input, data, deps.now?.() ?? new Date(), founder);
    });
  }
  return applyScratchpadUpdate(
    deps.prisma,
    existing,
    input,
    data,
    deps.now?.() ?? new Date(),
    founder,
  );
}

async function approveDirectoryItem(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: FounderScratchpadUpdateInput,
  observed: ScratchpadRow,
  founder: boolean,
) {
  return deps.prisma.$transaction(async (tx) => {
    await lockScope(tx, `gtm-channel:${input.spaceId}:${input.userId}:${input.botId}:directory`);
    const existing = await scopedItem(tx, input);
    if (!existing || existing.updatedAt.getTime() !== observed.updatedAt.getTime()) {
      return founder ? { conflict: true as const } : { error: "Scratchpad item changed; retry." };
    }
    if (
      existing.category !== "create_account" ||
      existing.channel !== "directory" ||
      existing.status !== "parked" ||
      existing.approvedAt !== null ||
      isEffectKey(existing.proof)
    ) {
      return { error: "Directory approval requires an unchanged parked item." };
    }
    const now =
      deps.now?.() ??
      (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!.now;
    const scope = { ...scopeOf(input), category: "create_account", channel: "directory" };
    if (!founder) {
      const window = {
        ...scope,
        approvedAt: { gt: new Date(now.getTime() - 86_400_000), lte: now },
      };
      const founders = await tx.scratchpadApproval.findMany({
        where: { ...window, approvedBy: "user" },
        distinct: ["itemId"],
        select: { itemId: true },
      });
      if (founders.length < APPROVALS_BEFORE_AUTO) {
        return {
          error:
            "Directory automation needs three distinct founder approvals in the last 24 hours.",
        };
      }
      const grants = await tx.scratchpadApproval.count({
        where: { ...window, approvedBy: "policy" },
      });
      if (grants >= AUTO_DAILY_CAP) {
        return { error: "Directory automation has reached five openings in the last 24 hours." };
      }
    }
    const approvedBy = founder ? "user" : "policy";
    const result = await applyScratchpadUpdate(
      tx,
      existing,
      input,
      { status: "open", approvedAt: now, approvedBy },
      now,
      founder,
      founder ? (renderedVersion(input.updatedAt) ?? undefined) : undefined,
    );
    if ("item" in result) {
      await tx.scratchpadApproval.create({
        data: { ...scope, itemId: existing.id, approvedAt: now, approvedBy },
      });
    }
    return result;
  });
}

export function updateScratchpadItemFromTool(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: ScratchpadUpdateInput,
) {
  return updateScratchpadItem(deps, input, false);
}

/** The same change on many rows, each through the normal update and its gates. */
export async function updateScratchpadItemsFromTool(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: Scope & {
    itemIds: unknown;
    status?: string;
    notes?: string;
    dueAt?: string | null;
    waitingOn?: string | null;
  },
) {
  const { itemIds, ...change } = input;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return { error: "itemIds must be a list of ids." };
  }
  if (itemIds.length > SCRATCHPAD_BATCH_MAX) {
    return { error: `itemIds can hold at most ${SCRATCHPAD_BATCH_MAX} ids; update the rest next.` };
  }
  let updated = 0;
  const failed: { itemId: string; error: string }[] = [];
  for (const itemId of new Set(itemIds.map(String))) {
    const result = await updateScratchpadItemFromTool(deps, { ...change, itemId });
    if ("item" in result) updated += 1;
    else
      failed.push({ itemId, error: ("error" in result && result.error) || "Item changed; retry." });
  }
  return { updated, failed };
}

export function updateScratchpadItemFromUser(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: FounderScratchpadUpdateInput,
) {
  return updateScratchpadItem(deps, input, true);
}

export async function completeScratchpadItemFromTool(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: Scope & { itemId: string; proof?: string; reason?: string },
) {
  const { reason, ...rest } = input;
  if (reason !== undefined && reason.trim().length > TOOL_REASON_MAX) {
    return { error: `reason must be at most ${TOOL_REASON_MAX} characters.` };
  }
  return updateScratchpadItemFromTool(deps, {
    ...rest,
    status: "done",
    ...(reason !== undefined ? { resolvedReason: reason } : {}),
  });
}

async function removeScratchpadItem(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: Scope & { itemId: string },
  founder: boolean,
) {
  const existing = await scopedItem(deps.prisma, input);
  if (!existing) return { error: "Scratchpad item not found." };
  const category = categoryValue(existing.category);
  if (!founder && isGated(category)) {
    return { error: "Only the founder can remove gated items." };
  }
  if (isQueuedZernioPost(existing, deps.now?.() ?? new Date())) {
    return { error: "This post is queued in Zernio. You can discard it after its scheduled time." };
  }
  const result = await deps.prisma.scratchpadItem.deleteMany({
    where: {
      ...scopeOf(input),
      id: existing.id,
      updatedAt: existing.updatedAt,
      category,
    },
  });
  if (result.count !== 1) return { error: "Scratchpad item changed; retry." };
  return { ok: true as const, itemId: existing.id, title: existing.title };
}

export function removeScratchpadItemFromTool(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: Scope & { itemId: string },
) {
  return removeScratchpadItem(deps, input, false);
}

export function removeScratchpadItemFromUser(
  deps: ScratchpadToolDeps & { now?: () => Date },
  input: Scope & { itemId: string },
) {
  return removeScratchpadItem(deps, input, true);
}

export async function listScratchpadItemsFromTool(
  deps: ScratchpadToolDeps,
  input: Scope & { includeDone?: boolean },
) {
  const items = await listScratchpadItems(deps, {
    ...scopeOf(input),
    includeDone: input.includeDone,
  });
  return { items };
}

export async function hasApprovedOpenSignup(deps: ScratchpadToolDeps, scope: Scope) {
  return Boolean(
    await deps.prisma.scratchpadItem.findFirst({
      where: {
        ...scopeOf(scope),
        category: "create_account",
        status: "open",
        approvedAt: { not: null },
      },
    }),
  );
}

export async function hasApprovedOpenPost(deps: ScratchpadToolDeps, scope: Scope) {
  return Boolean(
    await deps.prisma.scratchpadItem.findFirst({
      where: {
        ...scopeOf(scope),
        category: "public_post",
        status: "open",
        approvedAt: { not: null },
        proof: null,
      },
    }),
  );
}

/** A post Zernio already has queued: it still publishes, so the local copy is not ours to drop. */
export function isQueuedZernioPost(
  row: {
    category?: unknown;
    status?: unknown;
    proof?: unknown;
    scheduledFor?: Date | null;
  },
  now: Date,
) {
  return (
    row.category === "public_post" &&
    row.status === "open" &&
    typeof row.proof === "string" &&
    row.proof.startsWith("zernio:") &&
    row.scheduledFor != null &&
    row.scheduledFor.getTime() > now.getTime()
  );
}

export async function findWorkableOpenItem(
  deps: ScratchpadToolDeps,
  scope: Scope,
  now: () => Date = () => new Date(),
) {
  const rows = await deps.prisma.scratchpadItem.findMany({
    where: { ...scopeOf(scope), status: "open" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.find((row) => row.category !== "goal" && !isQueuedZernioPost(row, now())) ?? null;
}

type ConsumeApprovedPostInput = Scope & {
  text: string;
  scheduledFor: string;
  target: string;
  effectKey: string;
  now?: () => Date;
};

export async function consumeApprovedPost(
  deps: ScratchpadToolDeps,
  input: ConsumeApprovedPostInput,
): Promise<{ count: 0 } | { count: 1; item: ReturnType<typeof mapScratchpadItem> }> {
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).some((key) => !CONSUME_APPROVED_POST_INPUT_KEYS.has(key)) ||
    (input.now !== undefined && typeof input.now !== "function")
  ) {
    return { count: 0 };
  }
  if (typeof input.text !== "string" || typeof input.target !== "string") {
    return { count: 0 };
  }
  const text = input.text;
  const scheduledFor = parseAbsoluteDateTime(input.scheduledFor);
  const target = input.target;
  const now = input.now?.() ?? new Date();
  if (
    !text.trim() ||
    text.length > NOTES_MAX ||
    target.length === 0 ||
    target.length > TARGET_MAX ||
    !scheduledFor ||
    !Number.isFinite(now.getTime()) ||
    scheduledFor.getTime() < now.getTime() + 10 * 60_000 ||
    !isEffectKey(input.effectKey)
  ) {
    return { count: 0 };
  }

  return deps.prisma.$transaction(async (tx) => {
    await lockScope(tx, `scratchpad:consume:${input.spaceId}:${input.userId}:${input.botId}`);
    const tuple = {
      ...scopeOf(input),
      category: "public_post",
      status: "open",
      approvedAt: { not: null },
      notes: text,
      scheduledFor,
      target,
    };
    const replay = (await tx.scratchpadItem.findFirst({
      where: { ...tuple, proof: input.effectKey },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) as ScratchpadRow | null;
    if (replay) return { count: 1 as const, item: mapScratchpadItem(replay) };

    const candidate = (await tx.scratchpadItem.findFirst({
      where: { ...tuple, proof: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) as ScratchpadRow | null;
    if (!candidate) return { count: 0 as const };

    const consumedAt = updatedAtAfter(candidate, now);
    const result = await tx.scratchpadItem.updateMany({
      where: {
        id: candidate.id,
        ...scopeOf(input),
        category: "public_post",
        status: "open",
        updatedAt: candidate.updatedAt,
        approvedAt: candidate.approvedAt,
        approvedBy: candidate.approvedBy,
        proof: null,
        notes: text,
        scheduledFor,
        target,
      },
      data: { proof: input.effectKey, updatedAt: consumedAt },
    });
    if (result.count !== 1) return { count: 0 as const };
    return {
      count: 1 as const,
      item: mapScratchpadItem({ ...candidate, proof: input.effectKey, updatedAt: consumedAt }),
    };
  });
}

export async function clearPostStamp(
  deps: ScratchpadToolDeps,
  input: Scope & { itemId: string; effectKey: string },
): Promise<boolean> {
  if (!isEffectKey(input.effectKey)) return false;
  const result = await deps.prisma.scratchpadItem.updateMany({
    where: {
      ...scopeOf(input),
      id: input.itemId,
      proof: input.effectKey,
    },
    data: { proof: null },
  });
  return result.count === 1;
}
