import {
  CapTableLedgerRowSchema,
  CapTableSnapshotInputSchema,
  ContactKindSchema,
  ContactSaveInputSchema,
  isCartaAgentSpawnKey,
  isInvestorsAgentSpawnKey,
} from "@rakazo/contracts";
import {
  atCapPercent,
  capTableMath,
  equityRaisedUsd,
  investedByHolder,
  isSafeSecurity,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import {
  addContactIfNew,
  CapTableSourceError,
  ContactEmailTakenError,
  contactMatchWhere,
  equityLedgerHasData,
  equityLedgerSnapshot,
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

/** Holders per cap_table_read call, so a large ledger cannot flood the model context. */
const CAP_TABLE_PAGE = 100;

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
  // The whole client: the ledger-derived cap table reads many equity tables.
  prisma: PrismaClient;
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
      const {
        id: _id,
        stage: _stage,
        checkSizeCents: _check,
        nextStep: _next,
        pipelineRecordId: _record,
        ...rest
      } = args;
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
      // Once the ledger has data it is the record; the legacy snapshot is then stale.
      const snapshot =
        ((await equityLedgerHasData(deps.prisma, deps.scope))
          ? await equityLedgerSnapshot(deps.prisma, deps.scope)
          : null) ?? (await getCapTableSnapshot(deps.prisma, deps.scope));
      // The page's own figure replaces whatever amount raised the source stored.
      // A large ledger must not flood the model: holders come in pages of CAP_TABLE_PAGE.
      const all = snapshot
        ? capTableMath(snapshot)
            .holders.filter(({ holder }) => !isSafeSecurity(holder.security))
            .map(({ holder, percent }) => ({ ...holder, ownershipPercent: percent }))
        : [];
      const start = Math.max(0, Math.trunc(Number(args.after)) || 0);
      const page = all.slice(start, start + CAP_TABLE_PAGE);
      return {
        capTable: snapshot && {
          ...snapshot,
          // The page computes percents from shares; the agent gets the same figures (null for SAFEs).
          // SAFEs are listed under `safes`, as on the page, never as table holders.
          holders: page,
          holdersTotal: all.length,
          nextAfter: start + page.length < all.length ? start + page.length : null,
          amountRaisedUsd: equityRaisedUsd(snapshot.holders, allSafes),
          amountRaisedSource: "Invested by holders in the table plus Funded SAFEs",
        },
        safes,
      };
    }
    if (name === "cap_table_update") {
      // The ledger is the record once it has data; a save here would land in the stale legacy table.
      if (await equityLedgerHasData(deps.prisma, deps.scope))
        return {
          error:
            "The cap table is kept in the equity ledger on the Cap table page, so nothing was changed. Ask the user to make the change there.",
        };
      // The writer comes from the agent, never from the model, so it cannot name another source.
      const writer = deps.writer ?? "carta";
      const { ledger: rawLedger, ...rest } = args;
      const ledger = CapTableLedgerRowSchema.array().safeParse(rawLedger ?? []);
      if (!ledger.success) return { error: `ledger: ${ledger.error.issues[0]?.message}` };
      // Holders in the ledger get its cash; SAFEs stay with Mercury and are never given an amount here.
      const invested = investedByHolder(ledger.data);
      // Carta lists a holder once per security; the total goes on the first row only, so it counts once.
      const given = new Set<string>();
      const holders = Array.isArray(rest.holders)
        ? rest.holders.map((h: { name?: string; security?: string }) => {
            const name = typeof h.name === "string" ? h.name.trim() : "";
            if (!invested.has(name) || isSafeSecurity(String(h.security))) return h;
            if (given.has(name)) return { ...h, amountUsd: null };
            given.add(name);
            return { ...h, amountUsd: invested.get(name) };
          })
        : rest.holders;
      const input = CapTableSnapshotInputSchema.safeParse({ ...rest, holders, source: writer });
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
      // The tool never updates by id and never creates: it changes the contact with this email, or name and organization.
      // The pipeline stage is the founder's to change from the Fundraising page, never an agent's.
      const {
        id: _id,
        stage: _stage,
        checkSizeCents: _check,
        nextStep: _next,
        pipelineRecordId: _record,
        ...rest
      } = args;
      const input = ContactSaveInputSchema.safeParse(rest);
      if (!input.success) return { error: input.error.issues.map((i) => i.message).join("; ") };
      const { email, ...fields } = input.data;
      const name = input.data.name.trim();
      const organization = input.data.organization?.trim() || null;
      const owner = { spaceId: deps.scope.spaceId, userId: deps.scope.userId };
      const find = (where: object) =>
        deps.prisma.contact.findFirst({
          where: { ...owner, ...where },
          orderBy: { id: "asc" },
          select: { id: true },
        });
      // By email first; a contact without one is found by name and organization, and gains the email.
      const existing = email
        ? ((await find({ email })) ??
          (await find({ email: null, ...contactMatchWhere({ name, organization }) })))
        : await find(contactMatchWhere({ name, organization }));
      if (!existing)
        return {
          error: email
            ? "No contact with this email. Use contacts_add for new people."
            : "No contact with this name and organization. Use contacts_add for new people.",
        };
      const contact = await saveContact(
        deps.prisma,
        deps.scope,
        { ...fields, ...(email ? { email } : {}), id: existing.id },
        deps.botId,
      );
      return { contact };
    }
    return { error: `Unknown contact tool ${name}` };
  } catch (error) {
    if (error instanceof ContactEmailTakenError) return { error: error.message };
    return { error: "Contact tool failed" };
  }
}
