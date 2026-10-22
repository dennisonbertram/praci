import type { InvestorUpdate } from "@rakazo/contracts";
import { InvestorAudienceSchema, isInvestorsAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  getInvestorUpdate,
  InvestorUpdateLockedError,
  IsolationError,
  listInvestorUpdates,
  saveInvestorUpdate,
  upsertAuditRequest,
} from "@rakazo/db";
import * as z from "zod";
import { mailToolsAllowed } from "./mail-tools.js";

/** Both are offered to the Investors agent only; see `investorUpdateToolsAllowed`. */
export const INVESTOR_UPDATE_TOOL_NAMES = new Set([
  "investor_update_draft",
  "audit_request_upsert",
]);

/** Only the Investors agent, on a run its owner started (a direct message or its own routine). */
export function investorUpdateToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & { botSpawnKey: string | null | undefined },
): boolean {
  return isInvestorsAgentSpawnKey(options.botSpawnKey) && mailToolsAllowed(options);
}

type Deps = {
  prisma: Pick<PrismaClient, "investorUpdate" | "contact" | "composeSend" | "space">;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
};

const Args = z.object({
  action: z.enum(["history", "get", "save", "create"]),
  id: z.string().min(1).optional(),
  audience: InvestorAudienceSchema.optional(),
  subject: z.string().trim().max(998).optional(),
  period: z
    .string()
    .regex(/^\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])$/)
    .optional(),
  body: z.string().max(100_000).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const shown = (u: InvestorUpdate) => ({
  id: u.id,
  audience: u.audience,
  subject: u.subject,
  period: u.period,
  status: u.status,
  sentAt: u.sentAt,
  body: u.body,
});

/**
 * Past updates, and the drafts on the Investors page. The agent can read a sent update and write only
 * a draft; it never sends one (that is the founder's click on the page).
 */
export async function investorUpdateToolFromTool(
  deps: Deps,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const parsed = Args.safeParse(args);
  if (!parsed.success)
    return {
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  const input = parsed.data;
  try {
    if (input.action === "history") {
      const all = await listInvestorUpdates(deps.prisma, deps.scope);
      const sent = all.filter(
        (u) =>
          (u.status === "sent" || u.status === "partly_sent") &&
          (!input.audience || u.audience === input.audience),
      );
      return { updates: sent.slice(0, input.limit ?? 5).map(shown) };
    }
    if (input.action === "create") {
      const draft = await saveInvestorUpdate(deps.prisma, deps.scope, {
        audience: input.audience ?? "investors",
        subject: input.subject,
        period: input.period,
        body: input.body,
      });
      return {
        update: shown(draft),
        note: "Saved as a draft on the Investors page. Nothing was sent.",
      };
    }
    if (!input.id) return { error: "id is required" };
    if (input.action === "get")
      return { update: shown(await getInvestorUpdate(deps.prisma, deps.scope, input.id)) };
    const saved = await saveInvestorUpdate(deps.prisma, deps.scope, {
      id: input.id,
      subject: input.subject,
      period: input.period,
      body: input.body,
    });
    return { update: shown(saved), note: "Draft saved. Nothing was sent." };
  } catch (error) {
    if (error instanceof InvestorUpdateLockedError)
      return {
        error: "That update was already sent, so it cannot be changed. Create a new draft.",
      };
    if (error instanceof IsolationError) return { error: "No update with this id." };
    return { error: "Investor update tool failed" };
  }
}

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const AuditArgs = z.object({
  id: z.string().min(1).optional(),
  fund: z.string().trim().min(1).max(300).optional(),
  asOf: Day.nullable().optional(),
  asOfMatched: z.boolean().optional(),
  dueDate: Day.nullable().optional(),
  notes: z.string().max(5000).optional(),
  draftRef: z.string().max(500).nullable().optional(),
  dataRoomItemId: z.string().min(1).nullable().optional(),
  drafted: z.boolean().optional(),
});

/**
 * The Audit requests on the Investors page. With the row id from the intake it corrects that row and
 * can move it to drafted; with none it returns the open row with the same fund and as-of date or adds
 * one. It never closes a request: only the founder does (Mark done or Dismiss).
 */
export async function auditRequestToolFromTool(
  deps: { prisma: Pick<PrismaClient, "auditRequest">; scope: { spaceId: string; userId: string } },
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const parsed = AuditArgs.safeParse(args);
  if (!parsed.success)
    return {
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  if (!parsed.data.id && !parsed.data.fund) return { error: "fund is required without an id" };
  try {
    const { request, created } = await upsertAuditRequest(deps.prisma, deps.scope, parsed.data);
    return {
      request: {
        id: request.id,
        fund: request.fund,
        asOf: request.asOf,
        dueDate: request.dueDate,
        status: request.status,
      },
      created,
      note:
        request.status === "done" || request.status === "dismissed"
          ? "The founder already closed this request, so nothing was changed."
          : created
            ? "Added to Audit requests on the Investors page."
            : "Saved on the Investors page.",
    };
  } catch (error) {
    if (error instanceof IsolationError) return { error: "No audit request with this id." };
    return { error: "Audit request tool failed" };
  }
}
