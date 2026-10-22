import {
  CapTableSnapshotInputSchema,
  ContactKindSchema,
  ContactSaveInputSchema,
  isCartaAgentSpawnKey,
  isInvestorsAgentSpawnKey,
} from "@rakazo/contracts";
import { atCapPercent, capTableMath, equityRaisedUsd } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import {
  addContactIfNew,
  CapTableSourceError,
  ContactEmailTakenError,
  getCapTableSnapshot,
  listContacts,
  listSafes,
  saveCapTableSnapshot,
  saveContact,
} from "@rakazo/db";
import { mailToolsAllowed } from "./mail-tools.js";

/** The user's important contacts, offered to every agent on an owner-started run. */
export const CONTACT_ONLY_TOOL_NAMES = new Set(["contacts_list", "contacts_add", "contacts_save"]);

/** The Carta agent's Investors page tools. */
export const CAP_TABLE_TOOL_NAMES = new Set(["cap_table_read", "cap_table_update"]);

export const CONTACT_TOOL_NAMES = new Set([...CONTACT_ONLY_TOOL_NAMES, ...CAP_TABLE_TOOL_NAMES]);

/** Any agent, on a run its owner started (a direct message or their own routine). */
export const contactToolsAllowed = mailToolsAllowed;

/** Only the Carta and Investors agents, on a run their owner started. */
export function capTableToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & { botSpawnKey: string | null | undefined },
): boolean {
  return (
    (isCartaAgentSpawnKey(options.botSpawnKey) || isInvestorsAgentSpawnKey(options.botSpawnKey)) &&
    mailToolsAllowed(options)
  );
}

type ContactToolDeps = {
  prisma: Pick<
    PrismaClient,
    "$transaction" | "contact" | "capTableSnapshot" | "fundraiseRound" | "safe"
  >;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
  /** The agent running the tool, from the run, never from model input. */
  botId?: string;
  /** Which source cap_table_update writes as: the Investors agent reads the sheet, the Carta agent Carta. */
  writer?: "carta" | "sheet";
};

export async function contactToolFromTool(
  name: string,
  deps: ContactToolDeps,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    if (name === "contacts_list") {
      const kind = ContactKindSchema.safeParse(args.kind);
      const text = typeof args.query === "string" ? args.query : undefined;
      const contacts = await listContacts(deps.prisma, deps.scope, {
        kind: kind.success ? kind.data : undefined,
        text,
      });
      return { contacts };
    }
    if (name === "contacts_add") {
      // The pipeline stage is the founder's to change from the Fundraising page, never an agent's.
      const { id: _id, stage: _stage, checkSizeCents: _check, nextStep: _next, ...rest } = args;
      const input = ContactSaveInputSchema.safeParse(rest);
      if (!input.success) return { error: input.error.issues.map((i) => i.message).join("; ") };
      const { contact, created } = await addContactIfNew(
        deps.prisma,
        deps.scope,
        input.data,
        deps.botId,
      );
      return created
        ? { contact }
        : {
            contact,
            alreadySaved: true,
            note: `Already saved as ${contact.kind}; nothing was changed. Use contacts_save to change the kind.`,
          };
    }
    if (name === "cap_table_read") {
      // What the Cap Table page shows, so the agent can answer from it without Carta.
      // SAFEs are never inside the table's 100%; Drafts are not on the Cap Table page at all.
      const allSafes = await listSafes(deps.prisma, deps.scope);
      const safes = allSafes
        .filter((s) => s.status !== "draft")
        .map((s) => ({
          investor: s.investorName,
          status: s.status,
          amountUsd: s.amountCents / 100,
          postMoneyCapUsd: s.capCents == null ? null : s.capCents / 100,
          atCapPercent: atCapPercent(s),
        }));
      const snapshot = await getCapTableSnapshot(deps.prisma, deps.scope);
      // The page's own figure replaces whatever amount raised the source stored.
      return {
        capTable: snapshot && {
          ...snapshot,
          // The page computes percents from shares; the agent gets the same figures (null for SAFEs).
          holders: capTableMath(snapshot).holders.map(({ holder, percent }) => ({
            ...holder,
            ownershipPercent: percent,
          })),
          amountRaisedUsd: equityRaisedUsd(snapshot.holders, allSafes),
          amountRaisedSource: "Invested by holders in the table plus Funded SAFEs",
        },
        safes,
      };
    }
    if (name === "cap_table_update") {
      // The writer comes from the agent, never from the model, so it cannot name another source.
      const writer = deps.writer ?? "carta";
      const input = CapTableSnapshotInputSchema.safeParse({ ...args, source: writer });
      if (!input.success)
        return {
          error: input.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        };
      try {
        await saveCapTableSnapshot(deps.prisma, deps.scope, input.data);
      } catch (error) {
        if (error instanceof CapTableSourceError)
          return {
            error:
              writer === "sheet"
                ? "The cap table is not read from this sheet, or the update has no holders, so nothing was changed."
                : "The cap table is not read from Carta, so nothing was changed.",
          };
        throw error;
      }
      return { ok: true };
    }
    if (name === "contacts_save") {
      // The tool never updates by id and never creates: it changes the contact with this email.
      // The pipeline stage is the founder's to change from the Fundraising page, never an agent's.
      const { id: _id, stage: _stage, checkSizeCents: _check, nextStep: _next, ...rest } = args;
      const input = ContactSaveInputSchema.safeParse(rest);
      if (!input.success) return { error: input.error.issues.map((i) => i.message).join("; ") };
      const existing = input.data.email
        ? await deps.prisma.contact.findFirst({
            where: {
              spaceId: deps.scope.spaceId,
              userId: deps.scope.userId,
              email: input.data.email,
            },
            select: { id: true },
          })
        : null;
      if (!existing)
        return { error: "No contact with this email. Use contacts_add for new people." };
      return {
        contact: await saveContact(deps.prisma, deps.scope, { ...input.data, id: existing.id }),
      };
    }
    return { error: `Unknown contact tool ${name}` };
  } catch (error) {
    if (error instanceof ContactEmailTakenError) return { error: error.message };
    return { error: "Contact tool failed" };
  }
}
