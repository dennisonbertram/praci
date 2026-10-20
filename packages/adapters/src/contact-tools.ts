import {
  CapTableSnapshotInputSchema,
  ContactKindSchema,
  ContactSaveInputSchema,
  isCartaAgentSpawnKey,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  addContactIfNew,
  ContactEmailTakenError,
  getCapTableSnapshot,
  listContacts,
  saveCapTableSnapshot,
  saveContact,
} from "@rakazo/db";
import { mailToolsAllowed } from "./mail-tools.js";

/** The user's important contacts, offered to every agent on an owner-started run. */
export const CONTACT_ONLY_TOOL_NAMES = new Set(["contacts_list", "contacts_add", "contacts_save"]);

/** The Carta agent's Cap Table page tools. */
export const CAP_TABLE_TOOL_NAMES = new Set(["cap_table_read", "cap_table_update"]);

export const CONTACT_TOOL_NAMES = new Set([...CONTACT_ONLY_TOOL_NAMES, ...CAP_TABLE_TOOL_NAMES]);

/** Any agent, on a run its owner started (a direct message or their own routine). */
export const contactToolsAllowed = mailToolsAllowed;

/** Only the Carta agent, on a run its owner started. */
export function capTableToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & { botSpawnKey: string | null | undefined },
): boolean {
  return isCartaAgentSpawnKey(options.botSpawnKey) && mailToolsAllowed(options);
}

type ContactToolDeps = {
  prisma: Pick<PrismaClient, "contact" | "capTableSnapshot">;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
  /** The agent running the tool, from the run, never from model input. */
  botId?: string;
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
      const { id: _id, ...rest } = args;
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
        : { contact, alreadySaved: true, note: "Already saved; nothing was changed." };
    }
    if (name === "cap_table_read") {
      // What the Cap Table page shows, so the agent can answer from it without Carta.
      return { capTable: await getCapTableSnapshot(deps.prisma, deps.scope) };
    }
    if (name === "cap_table_update") {
      const input = CapTableSnapshotInputSchema.safeParse(args);
      if (!input.success)
        return {
          error: input.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        };
      await saveCapTableSnapshot(deps.prisma, deps.scope, input.data);
      return { ok: true };
    }
    if (name === "contacts_save") {
      // The tool never updates by id and never creates: it changes the contact with this email.
      const { id: _id, ...rest } = args;
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
