import * as z from "zod";
import { Id } from "./ids.js";

const WatchIntervalSchema = z.union([z.literal(15), z.literal(60), z.literal(1440)]);

/** What a routine watches: a web page, or one read-only tool of a connected app. */
export const PageWatchSpecSchema = z.object({
  kind: z.literal("page"),
  url: z
    .string()
    .max(2048)
    .refine((value) => {
      try {
        const { protocol } = new URL(value);
        return protocol === "https:" || protocol === "http:";
      } catch {
        return false;
      }
    }, "Enter an http or https address"),
  intervalMinutes: WatchIntervalSchema,
});

/**
 * One read-only tool of a connected app, with fixed arguments. Only the bot creates it, from chat
 * (watch_create); no screen or API input accepts it. The route fields come from the tool the bot
 * was offered, and every check resolves them again through the executor's connector path.
 */
export const ConnectorWatchSpecSchema = z.object({
  kind: z.literal("connector"),
  connectorId: z.string().min(1).max(64),
  connectionId: z.string().min(1).max(128).optional(),
  resourceId: z.string().min(1).max(128).optional(),
  toolName: z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/),
  arguments: z
    .record(z.string(), z.json())
    .refine((value) => JSON.stringify(value).length <= 4096, "Arguments are too long"),
  /** The app's display name, for the approval card, the editor and the wake prompt. */
  appName: z.string().regex(/^[A-Za-z0-9 ._-]{1,60}$/),
  intervalMinutes: WatchIntervalSchema,
});
export type ConnectorWatchSpec = z.infer<typeof ConnectorWatchSpecSchema>;

/** The tool without its app prefix, in words: "mcp__mercury__get_accounts" gives "get accounts". */
export function connectorToolLabel(toolName: string): string {
  const last = toolName.split("__").pop() ?? toolName;
  return last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

export const WatchSpecSchema = z.discriminatedUnion("kind", [
  PageWatchSpecSchema,
  ConnectorWatchSpecSchema,
]);
export type PageWatchSpec = z.infer<typeof PageWatchSpecSchema>;
export type WatchSpec = z.infer<typeof WatchSpecSchema>;

/** "credit": the routine's model connection ran out of credit; it runs again on its own. */
export const WatchPausedReasonSchema = z.enum(["errors", "noisy", "budget", "access", "credit"]);
export type WatchPausedReason = z.infer<typeof WatchPausedReasonSchema>;

/** The one managed routine kind: a bot's check-in. */
export const RoutineManagedKindSchema = z.literal("check_in");
export type RoutineManagedKind = z.infer<typeof RoutineManagedKindSchema>;

/** One muted status line for a routine list row. Watch fields are null for non-watches. */
export const RoutineStatusSchema = z.object({
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  lastCheckedAt: z.string().nullable(),
  lastChangedAt: z.string().nullable(),
  pausedReason: WatchPausedReasonSchema.nullable(),
  /** True when the routine's newest finished run failed. */
  lastRunFailed: z.boolean().optional(),
});
export type RoutineStatus = z.infer<typeof RoutineStatusSchema>;

export const CheckInCadenceSchema = z.enum(["off", "daily", "every_4h"]);

/**
 * A bot's check-in setting is its managed routine (managedKind "check_in"): its crons
 * and active flag are the setting, so there is no Bot column.
 */
export const CheckInGetInput = z.object({ botId: Id });
export const CheckInSetInput = z.object({ botId: Id, cadence: CheckInCadenceSchema });
export const CheckInSchema = z.object({ cadence: CheckInCadenceSchema });
export type CheckIn = z.infer<typeof CheckInSchema>;
