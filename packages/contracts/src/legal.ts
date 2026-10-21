import * as z from "zod";
import { Id } from "./ids.js";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The one place the Legal agent's spawn key is built. */
export const legalAgentSpawnKey = (userId: string) => `legal-agent:${userId}`;

export const isLegalAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(legalAgentSpawnKey("")));

/** The model the Legal agent runs on: Meta Muse Spark 1.2 via OpenRouter (never a -contributor SKU). */
export const LEGAL_AGENT_MODEL = {
  provider: "openrouter",
  id: "meta/muse-spark-1.2",
  /** The level the model was benchmarked at; the catalog lists xhigh as supported for it. */
  thinkingLevel: "xhigh",
} as const;

/** Shown when a Legal run resolves to any other model; the agent runs on Muse Spark 1.2 only. */
export const LEGAL_MODEL_REQUIRED_MESSAGE =
  "The Legal agent runs only on Muse Spark 1.2, which needs your own OpenRouter key. Add it in Settings > Models > OpenRouter.";

/** Shown when a Legal run stops because the user has not yet allowed it to read their documents. */
export const LEGAL_CONSENT_REQUIRED_MESSAGE =
  "Legal needs your permission to read your documents before it can run.";

/** Name of the Legal agent's daily routine. */
export const LEGAL_SCAN_ROUTINE_NAME = "Daily legal scan";

/** The only built-in tools the Legal agent is offered (mail, drive and calendar are read-only). */
export const LEGAL_AGENT_BUILTIN_TOOLS = [
  "search_data_room",
  "read_data_room_item",
  "read_spreadsheet",
  "legal_unreviewed_documents",
  "legal_upsert_contract",
  "legal_upsert_deadline",
  "legal_upsert_node",
  "legal_link",
  "legal_query",
  "mail_search",
  "contacts_list",
  "contacts_add",
  "mail_grep",
  "mail_get",
  "drive_search",
  "drive_read",
  "calendar_list_events",
  "calendar_get_event",
  "web_search",
  "web_fetch",
  "remember",
  "save_memory",
  "recall_memory",
  "forget_memory",
  "save_shared_memory",
  "ask_user",
  "notify_user",
] as const;

export const LegalContractStatusSchema = z.enum([
  "active",
  "expired",
  "terminated",
  "draft",
  "unknown",
]);
export type LegalContractStatus = z.infer<typeof LegalContractStatusSchema>;

export const LegalDeadlineKindSchema = z.enum([
  "renewal",
  "notice",
  "termination",
  "payment",
  "filing",
  "compliance",
  "other",
]);
export type LegalDeadlineKind = z.infer<typeof LegalDeadlineKindSchema>;

export const LegalDeadlineStatusSchema = z.enum(["open", "done", "dismissed"]);
export type LegalDeadlineStatus = z.infer<typeof LegalDeadlineStatusSchema>;

export const LegalNodeKindSchema = z.enum([
  "company",
  "person",
  "contract",
  "obligation",
  "right",
  "asset",
  "jurisdiction",
  "other",
]);
export type LegalNodeKind = z.infer<typeof LegalNodeKindSchema>;

/** Dates are "YYYY-MM-DD" strings; money is integer minor units sent as a decimal string. */
export const LegalContractSchema = z.object({
  id: Id,
  dataRoomItemId: Id,
  title: z.string(),
  contractType: z.string(),
  counterparties: z.array(z.string()),
  status: LegalContractStatusSchema,
  effectiveDate: IsoDate.nullable(),
  expirationDate: IsoDate.nullable(),
  autoRenews: z.boolean().nullable(),
  renewalNoticeDays: z.number().int().nullable(),
  governingLaw: z.string().nullable(),
  valueCents: z
    .string()
    .regex(/^-?\d+$/)
    .nullable(),
  currency: z.string().nullable(),
  summary: z.string().nullable(),
  analyzedRevision: z.number().int(),
  analyzedAt: z.string().datetime(),
  /** The next date to act on: the nearest open deadline of this contract, else null. */
  nextDeadline: IsoDate.nullable(),
});
export type LegalContract = z.infer<typeof LegalContractSchema>;

export const LegalDeadlineSchema = z.object({
  id: Id,
  contractId: Id.nullable(),
  /** Title of the contract the deadline belongs to, for display. */
  contractTitle: z.string().nullable(),
  dataRoomItemId: Id.nullable(),
  title: z.string(),
  dueDate: IsoDate,
  kind: LegalDeadlineKindSchema,
  status: LegalDeadlineStatusSchema,
  sourceQuote: z.string().nullable(),
  notes: z.string().nullable(),
});
export type LegalDeadline = z.infer<typeof LegalDeadlineSchema>;

export const LegalOverviewSchema = z.object({
  contracts: z.array(LegalContractSchema),
  /** Open deadlines, soonest first (overdue ones first of all). */
  deadlines: z.array(LegalDeadlineSchema),
  counts: z.object({
    contracts: z.number().int(),
    activeContracts: z.number().int(),
    openDeadlines: z.number().int(),
    overdueDeadlines: z.number().int(),
    /** Data Room items the agent has not analyzed yet, or analyzed at an older revision. */
    unreviewedDocuments: z.number().int(),
  }),
  /** Whether the Legal agent exists, and when it last finished a scan run (ISO) if known. */
  agent: z.object({
    botId: Id.nullable(),
    lastScanAt: z.string().datetime().nullable(),
    /** Whether the daily scan routine is switched on; Scan now works either way. */
    dailyScanActive: z.boolean(),
    /** The newest scan run (daily or Scan now), whatever its outcome; `error` is set when it failed. */
    lastScanRun: z
      .object({
        id: Id,
        status: z.enum(["running", "completed", "failed", "cancelled"]),
        error: z.string().nullable(),
      })
      .nullable(),
  }),
  /**
   * The model the Legal agent will actually run on. Without the user's own credential for the
   * preferred provider, Praci falls back to the space default, so this can differ from LEGAL_AGENT_MODEL.
   * Null when the agent does not exist yet or no model resolves.
   */
  model: z.object({ provider: z.string(), id: z.string(), isPreferred: z.boolean() }).nullable(),
  /**
   * Why the Legal agent cannot run on Muse Spark 1.2, or null when it can. "own_key": the user has no
   * OpenRouter key of their own (a space or server key is not used for the Legal agent).
   * "model_changed": the Legal agent was set to another model.
   */
  modelBlocker: z.enum(["own_key", "model_changed"]).nullable(),
});
export type LegalOverview = z.infer<typeof LegalOverviewSchema>;

export const LegalNodeSchema = z.object({
  id: Id,
  kind: LegalNodeKindSchema,
  label: z.string(),
  attrs: z.record(z.string(), z.unknown()).nullable(),
  contractId: Id.nullable(),
});
export type LegalNode = z.infer<typeof LegalNodeSchema>;

export const LegalEdgeSchema = z.object({
  id: Id,
  fromId: Id,
  toId: Id,
  relation: z.string(),
  dataRoomItemId: Id.nullable(),
  sourceQuote: z.string().nullable(),
});
export type LegalEdge = z.infer<typeof LegalEdgeSchema>;

export const LegalGraphSchema = z.object({
  nodes: z.array(LegalNodeSchema),
  edges: z.array(LegalEdgeSchema),
});
export type LegalGraph = z.infer<typeof LegalGraphSchema>;

export const LegalUpdateDeadlineInputSchema = z.object({
  id: Id,
  status: LegalDeadlineStatusSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** What deleting a Data room item also removes from Legal: its contract and that contract's deadlines. */
export const LegalItemLinksSchema = z.object({
  contractTitle: z.string().nullable(),
  deadlines: z.number().int(),
});
export type LegalItemLinks = z.infer<typeof LegalItemLinksSchema>;

export const LegalScanNowOutputSchema = z.object({
  /** The queued run, in the Legal agent's thread. */
  runId: Id,
  botId: Id,
});
