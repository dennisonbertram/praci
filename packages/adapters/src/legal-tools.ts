import type { Actor, LegalContract, LegalDeadline } from "@rakazo/contracts";
import {
  isLegalAgentSpawnKey,
  LegalContractStatusSchema,
  LegalDeadlineKindSchema,
  LegalDeadlineStatusSchema,
  LegalNodeKindSchema,
} from "@rakazo/contracts";
import type { LegalContractRecord, LegalDeadlineRecord, PrismaClient } from "@rakazo/db";
import { createLegalRepos, IsolationError, LEGAL_NOT_LEGAL_TYPE, parseLegalDay } from "@rakazo/db";
import * as z from "zod";
import { DATA_ROOM_TOOL_NAMES } from "./data-room-tools.js";
import { mailToolsAllowed } from "./mail-tools.js";

export const LEGAL_TOOL_NAMES = new Set([
  "legal_unreviewed_documents",
  "legal_upsert_contract",
  "legal_upsert_deadline",
  "legal_upsert_node",
  "legal_link",
  "legal_query",
]);

/** Offered only to the Legal agent: its own tools plus the Data Room tools. */
export const LEGAL_GATED_TOOL_NAMES = new Set([...LEGAL_TOOL_NAMES, ...DATA_ROOM_TOOL_NAMES]);

/** Only the Legal agent, on a run its owner started (a direct message, a follow-up or its own routine). */
const OWNER_INITIATED_TRIGGERS = new Set(["user", "follow_up", "routine"]);
export function legalToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & {
    botSpawnKey: string | null | undefined;
    trigger: string;
  },
): boolean {
  return (
    isLegalAgentSpawnKey(options.botSpawnKey) &&
    OWNER_INITIATED_TRIGGERS.has(options.trigger) &&
    mailToolsAllowed(options)
  );
}

export interface LegalToolDeps {
  prisma: PrismaClient;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
  /** The Data Room consent check, shared with the Data Room tools. */
  allowed: () => Promise<boolean>;
  now?: () => Date;
}

// ---- Row mapping (shared with the API's Legal pages) ----

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

export const toLegalContract = (
  row: LegalContractRecord,
  nextDeadline: string | null = null,
): LegalContract => ({
  id: row.id,
  dataRoomItemId: row.dataRoomItemId,
  title: row.title,
  contractType: row.contractType,
  counterparties: row.counterparties,
  status: LegalContractStatusSchema.catch("unknown").parse(row.status),
  effectiveDate: day(row.effectiveDate),
  expirationDate: day(row.expirationDate),
  autoRenews: row.autoRenews,
  renewalNoticeDays: row.renewalNoticeDays,
  governingLaw: row.governingLaw,
  // Integer minor units cross the wire as a decimal string, never a JS number.
  valueCents: row.valueCents === null ? null : row.valueCents.toString(),
  currency: row.currency,
  summary: row.summary,
  analyzedRevision: row.analyzedRevision,
  analyzedAt: row.analyzedAt.toISOString(),
  nextDeadline,
});

export const toLegalDeadline = (
  row: LegalDeadlineRecord,
  contractTitle: string | null = null,
): LegalDeadline => ({
  id: row.id,
  contractId: row.contractId,
  contractTitle,
  dataRoomItemId: row.dataRoomItemId,
  title: row.title,
  dueDate: day(row.dueDate) as string,
  kind: LegalDeadlineKindSchema.catch("other").parse(row.kind),
  status: LegalDeadlineStatusSchema.catch("open").parse(row.status),
  sourceQuote: row.sourceQuote,
  notes: row.notes,
});

// ---- Input schemas ----

const Day = z
  .string()
  .refine((value) => parseLegalDay(value) !== null, "Use a real date as YYYY-MM-DD");
const Quote = z.string().trim().min(1).max(600);
const Id = z.string().min(1).max(100);
/** Integer minor units (cents), as a safe integer or a digit string. Never a fractional number. */
const Cents = z.union([
  z.number().int().refine(Number.isSafeInteger),
  z.string().regex(/^-?\d{1,18}$/),
]);

const ContractArgs = z.object({
  dataRoomItemId: Id,
  /** true: the document was read and is not a contract or legal document; nothing else is needed. */
  notLegal: z.boolean().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  contractType: z.string().trim().min(1).max(100).optional(),
  counterparties: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  status: LegalContractStatusSchema.optional(),
  effectiveDate: Day.nullable().optional(),
  expirationDate: Day.nullable().optional(),
  autoRenews: z.boolean().nullable().optional(),
  renewalNoticeDays: z.number().int().min(0).max(3650).nullable().optional(),
  governingLaw: z.string().trim().max(200).nullable().optional(),
  valueCents: Cents.nullable().optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .nullable()
    .optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
});

const DeadlineArgs = z.object({
  id: Id.optional(),
  contractId: Id.nullable().optional(),
  dataRoomItemId: Id.nullable().optional(),
  title: z.string().trim().min(1).max(300),
  dueDate: Day,
  kind: LegalDeadlineKindSchema,
  status: LegalDeadlineStatusSchema.optional(),
  sourceQuote: Quote.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const AttrValue = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);
const NodeArgs = z.object({
  kind: LegalNodeKindSchema,
  label: z.string().trim().min(1).max(300),
  attrs: z
    .record(z.string().max(60), AttrValue)
    .refine((a) => Object.keys(a).length <= 20)
    .optional(),
  contractId: Id.nullable().optional(),
});

const LinkArgs = z.object({
  fromId: Id,
  toId: Id,
  relation: z.string().trim().min(1).max(60),
  dataRoomItemId: Id.nullable().optional(),
  sourceQuote: Quote.nullable().optional(),
});

const QueryArgs = z.discriminatedUnion("view", [
  z.object({
    view: z.literal("contracts"),
    status: LegalContractStatusSchema.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  z.object({
    view: z.literal("deadlines"),
    status: LegalDeadlineStatusSchema.optional(),
    contractId: Id.optional(),
    /** Only deadlines due within this many days from today (overdue ones included). */
    withinDays: z.number().int().min(0).max(3650).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  z.object({
    view: z.literal("node"),
    nodeId: Id.optional(),
    kind: LegalNodeKindSchema.optional(),
    label: z.string().trim().min(1).max(300).optional(),
  }),
]);

const UnreviewedArgs = z.object({ limit: z.number().int().min(1).max(100).optional() });

const REFUSAL =
  "The user has not agreed to send Data Room documents to this agent's model provider, so the Data Room cannot be read. Ask the user to allow it for this agent, then try again.";
const DAY_MS = 86_400_000;
const NOTICE_NOTE = "Derived from the expiration date and the notice period.";

const actorOf = (scope: LegalToolDeps["scope"]): Actor => ({
  ...scope,
  email: "",
  isDeploymentOwner: false,
});
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const issues = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");

// ---- Activity labels ----

/** A one-line description of a legal tool call for the live activity line, or null for other tools. */
export function describeLegalActivity(name: string, args: Record<string, unknown>): string | null {
  if (name === "legal_unreviewed_documents") return "Checking for unreviewed legal documents";
  if (name === "legal_upsert_contract") return `Recording a contract: ${String(args.title ?? "")}`;
  if (name === "legal_upsert_deadline") return `Recording a deadline: ${String(args.title ?? "")}`;
  if (name === "legal_upsert_node") return `Adding to the legal graph: ${String(args.label ?? "")}`;
  if (name === "legal_link") return "Linking items in the legal graph";
  if (name === "legal_query") return "Looking through contracts and deadlines";
  return null;
}

// ---- Tools ----

export async function legalToolFromTool(
  name: string,
  deps: LegalToolDeps,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const repo = createLegalRepos(deps.prisma);
    const actor = actorOf(deps.scope);
    if (name === "legal_unreviewed_documents") {
      const parsed = UnreviewedArgs.safeParse(args);
      if (!parsed.success) return { error: issues(parsed.error) };
      // Names, facets and summaries are document content, so they follow the same consent as reading.
      if (!(await deps.allowed())) return { error: REFUSAL, consentRequired: true };
      const [items, remaining] = await Promise.all([
        repo.unreviewedItems(actor, parsed.data.limit),
        repo.countUnreviewed(actor),
      ]);
      return {
        remaining,
        documents: items.map((item) => ({
          id: item.id,
          name: item.name,
          source: item.source,
          mimeType: item.mimeType,
          docType: item.docType,
          docDate: day(item.docDate),
          parties: item.parties,
          summary: item.summary,
          revision: item.revision,
        })),
      };
    }
    if (name === "legal_upsert_contract") return await upsertContract(deps, args);
    if (name === "legal_upsert_deadline") {
      const parsed = DeadlineArgs.safeParse(args);
      if (!parsed.success) return { error: issues(parsed.error) };
      const { dueDate, ...rest } = parsed.data;
      const row = await repo.upsertDeadline(actor, {
        ...rest,
        dueDate: parseLegalDay(dueDate) as Date,
      });
      return { deadline: toLegalDeadline(row) };
    }
    if (name === "legal_upsert_node") {
      const parsed = NodeArgs.safeParse(args);
      if (!parsed.success) return { error: issues(parsed.error) };
      const row = await repo.upsertNode(actor, parsed.data);
      return { node: { id: row.id, kind: row.kind, label: row.label, contractId: row.contractId } };
    }
    if (name === "legal_link") {
      const parsed = LinkArgs.safeParse(args);
      if (!parsed.success) return { error: issues(parsed.error) };
      const row = await repo.link(actor, parsed.data);
      return { edge: { id: row.id, fromId: row.fromId, toId: row.toId, relation: row.relation } };
    }
    if (name === "legal_query") return await query(deps, args);
    return { error: `Unknown legal tool ${name}` };
  } catch (error) {
    if (error instanceof IsolationError) {
      return { error: "No record with that id; use an id returned by a legal or Data Room tool" };
    }
    return { error: "Legal tool failed" };
  }
}

async function upsertContract(deps: LegalToolDeps, args: Record<string, unknown>) {
  const parsed = ContractArgs.safeParse(args);
  if (!parsed.success) return { error: issues(parsed.error) };
  const input = parsed.data;
  const repo = createLegalRepos(deps.prisma);
  const actor = actorOf(deps.scope);
  if (input.notLegal) {
    const row = await repo.upsertContract(actor, {
      dataRoomItemId: input.dataRoomItemId,
      title: input.title ?? "Not a legal document",
      contractType: LEGAL_NOT_LEGAL_TYPE,
      status: "unknown",
    });
    return { reviewed: true, contractId: row.id };
  }
  if (!input.title || !input.contractType || !input.status) {
    return { error: "title, contractType and status are required (or set notLegal: true)" };
  }
  const row = await repo.upsertContract(actor, {
    dataRoomItemId: input.dataRoomItemId,
    title: input.title,
    contractType: input.contractType,
    counterparties: input.counterparties,
    status: input.status,
    effectiveDate: input.effectiveDate ? parseLegalDay(input.effectiveDate) : null,
    expirationDate: input.expirationDate ? parseLegalDay(input.expirationDate) : null,
    autoRenews: input.autoRenews,
    renewalNoticeDays: input.renewalNoticeDays,
    governingLaw: input.governingLaw,
    valueCents:
      input.valueCents === null || input.valueCents === undefined ? null : BigInt(input.valueCents),
    currency: input.currency?.toUpperCase(),
    summary: input.summary,
  });
  const derived = await deriveDeadlines(deps, row);
  return {
    contract: toLegalContract(row),
    derivedDeadlines: derived.map((d) => toLegalDeadline(d)),
  };
}

/**
 * Opens the expiration and notice-of-non-renewal deadlines of a live contract, so the agent never does
 * date arithmetic itself. Each keeps one row (found by contract, kind and title): a changed
 * date moves it, and a deadline the user already closed stays closed.
 */
async function deriveDeadlines(deps: LegalToolDeps, contract: LegalContractRecord) {
  const repo = createLegalRepos(deps.prisma);
  const actor = actorOf(deps.scope);
  const wanted: { title: string; kind: string; dueDate: Date }[] = [];
  const live = contract.status === "active" || contract.status === "unknown";
  if (live && contract.expirationDate) {
    wanted.push({
      title: `${contract.autoRenews ? "Renews" : "Expires"}: ${contract.title}`,
      kind: contract.autoRenews ? "renewal" : "termination",
      dueDate: contract.expirationDate,
    });
    if (contract.renewalNoticeDays !== null) {
      wanted.push({
        title: `Notice deadline: ${contract.title}`,
        kind: "notice",
        dueDate: addDays(contract.expirationDate, -contract.renewalNoticeDays),
      });
    }
  }
  const out: LegalDeadlineRecord[] = [];
  for (const item of wanted) {
    const existing = await deps.prisma.legalDeadline.findFirst({
      where: { ...deps.scope, contractId: contract.id, kind: item.kind, title: item.title },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "open") continue;
    out.push(
      await repo.upsertDeadline(actor, {
        id: existing?.id,
        contractId: contract.id,
        dataRoomItemId: contract.dataRoomItemId,
        ...item,
        notes: NOTICE_NOTE,
      }),
    );
  }
  return out;
}

async function query(deps: LegalToolDeps, args: Record<string, unknown>) {
  const parsed = QueryArgs.safeParse(args);
  if (!parsed.success) return { error: issues(parsed.error) };
  const repo = createLegalRepos(deps.prisma);
  const actor = actorOf(deps.scope);
  const q = parsed.data;
  if (q.view === "contracts") {
    const rows = await repo.listContracts(actor, { limit: q.limit });
    return {
      contracts: rows
        .filter((row) => !q.status || row.status === q.status)
        .map((row) => toLegalContract(row)),
    };
  }
  if (q.view === "deadlines") {
    const today = parseLegalDay((deps.now?.() ?? new Date()).toISOString().slice(0, 10)) as Date;
    const rows = await repo.listDeadlines(actor, {
      status: q.status ?? "open",
      contractId: q.contractId,
      to: q.withinDays === undefined ? undefined : addDays(today, q.withinDays),
      limit: q.limit,
    });
    return {
      today: day(today),
      deadlines: rows.map((row) => toLegalDeadline(row)),
    };
  }
  const hood = await repo.neighborhood(actor, { id: q.nodeId, kind: q.kind, label: q.label });
  if (!hood) return { error: "No node matched" };
  const view = (n: { id: string; kind: string; label: string; attrs: unknown }) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    attrs: n.attrs,
  });
  return {
    node: view(hood.node),
    neighbors: hood.nodes.map(view),
    edges: hood.edges.map((e) => ({
      fromId: e.fromId,
      toId: e.toId,
      relation: e.relation,
      sourceQuote: e.sourceQuote,
    })),
  };
}
