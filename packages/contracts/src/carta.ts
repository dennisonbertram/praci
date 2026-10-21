import * as z from "zod";
import { IsoDate } from "./ids.js";

/** The one place the Carta agent's spawn key is built. */
export const cartaAgentSpawnKey = (userId: string) => `carta-agent:${userId}`;

export const isCartaAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(cartaAgentSpawnKey("")));

/** Carta's official remote MCP server. A server counts as Carta by its endpoint host. */
export const CARTA_MCP_ENDPOINT = "https://mcp.app.carta.com/mcp";

/** Whether an MCP server endpoint is Carta's, matched by https host. */
export function isCartaEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.host === new URL(CARTA_MCP_ENDPOINT).host;
  } catch {
    return false;
  }
}

/**
 * The tools the Carta agent may call on Carta's server, even when its assignment allows all tools.
 * From the server's real tools/list (2026-10-16). Left out: mutate and call_tool (writes),
 * request_permissions, skill_checkpoint and track_ui_event (record state), and view_static and
 * view_remote (render Carta's own UI, which Praci does not show). set_context only picks the company.
 */
export const CARTA_READ_TOOLS = [
  "welcome",
  "discover",
  "search_tools",
  "fetch",
  "read_tool",
  "list_resources",
  "read_resource",
  "list_contexts",
  "set_context",
  "list_accounts",
  "get_current_user",
  "cap_table_chart",
] as const;

/** Carta's tools that change data. Offered only when the user turns writes on, and each call asks first. */
export const CARTA_WRITE_TOOLS = ["mutate", "call_tool"] as const;

const Shares = z.number().int().nonnegative();
const Usd = z.number().nonnegative();
const Percent = z.number().min(0).max(100);
const Label = z.string().trim().min(1).max(200);

/** Who writes the cap table: Carta's agent, a Google Sheet read, or the founder's typed-in table. */
export const CapTableSourceSchema = z.enum(["carta", "sheet", "native"]);
export type CapTableSource = z.infer<typeof CapTableSourceSchema>;

/** The securities offered for a typed-in holder; names copied from the previous table are added to these. */
export const NATIVE_SECURITIES = ["Common", "Preferred", "Option", "Other"] as const;

/** The Google Sheet a sheet-sourced table was read from. */
export const CapTableSourceRefSchema = z.object({ driveFileId: Label, name: Label });
export type CapTableSourceRef = z.infer<typeof CapTableSourceRefSchema>;

/** What the Carta agent saves with cap_table_update. Figures come from Carta; nothing is estimated. */
export const CapTableSnapshotInputSchema = z.object({
  companyName: Label,
  /** The date Carta's figures are as of. */
  asOf: z.string().date(),
  fullyDilutedShares: Shares,
  /** The writer this update comes from; the save is refused when the stored table has another source. */
  source: CapTableSourceSchema.default("carta"),
  sourceRef: CapTableSourceRefSchema.nullable().default(null),
  amountRaisedUsd: Usd.nullable().default(null),
  optionPoolAvailable: Shares.nullable().default(null),
  latest409a: z.object({ pricePerShareUsd: Usd, date: z.string().date() }).nullable().default(null),
  shareClasses: z.array(z.object({ name: Label, shares: Shares, percent: Percent })).max(50),
  holders: z
    .array(
      z.object({
        /** Keeps a typed-in row's identity while it is edited; absent for Carta and sheet holders. */
        id: z.string().trim().min(1).max(64).optional(),
        name: Label,
        email: z.string().trim().toLowerCase().email().max(320).nullable().default(null),
        organization: Label.nullable().default(null),
        /** The security as Carta names it, e.g. "Series Seed Preferred" or "SAFE". */
        security: Label,
        shares: Shares.nullable().default(null),
        amountUsd: Usd.nullable().default(null),
        percent: Percent.nullable().default(null),
      }),
    )
    .max(500),
});
export type CapTableSnapshotInput = z.input<typeof CapTableSnapshotInputSchema>;

export const CapTableSnapshotSchema = CapTableSnapshotInputSchema.extend({
  updatedAt: IsoDate,
  /** True right after a source switch, until the next change. */
  canUndo: z.boolean().default(false),
});
export type CapTableSnapshot = z.infer<typeof CapTableSnapshotSchema>;

/** The Cap Table page's data: the latest snapshot, and whether the Carta agent is working on one. */
export const CapTableStateSchema = z.object({
  snapshot: CapTableSnapshotSchema.nullable(),
  syncing: z.boolean(),
  /** A Google Sheet read is running. */
  reading: z.boolean().default(false),
  /** The latest sheet read ended without a newer snapshot; the old table is kept. */
  lastReadFailed: z.boolean().default(false),
});
export type CapTableState = z.infer<typeof CapTableStateSchema>;

/** A typed-in table saved whole. `updatedAt` is the version it was loaded from. */
export const CapTableSaveInputSchema = z.object({
  table: CapTableSnapshotInputSchema,
  updatedAt: IsoDate,
});

export const CapTableChangeSourceInputSchema = z.object({
  source: CapTableSourceSchema,
  sourceRef: CapTableSourceRefSchema.nullable().default(null),
});
