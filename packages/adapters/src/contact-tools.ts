import { ContactKindSchema, ContactSaveInputSchema, isCartaAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { listContacts, saveContact } from "@rakazo/db";
import { mailToolsAllowed } from "./mail-tools.js";

export const CONTACT_TOOL_NAMES = new Set(["contacts_list", "contacts_save"]);

/** Only the Carta agent, on a run its owner started (a direct message or their own routine). */
const OWNER_INITIATED_TRIGGERS = new Set(["user", "follow_up", "routine"]);
export function contactToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & {
    botSpawnKey: string | null | undefined;
    trigger: string;
  },
): boolean {
  return (
    isCartaAgentSpawnKey(options.botSpawnKey) &&
    OWNER_INITIATED_TRIGGERS.has(options.trigger) &&
    mailToolsAllowed(options)
  );
}

/** Drop the contact tools when the run may not use them. */
export function selectContactTools<T extends { name: string }>(
  tools: T[],
  contactsEnabled: boolean,
): T[] {
  return contactsEnabled ? tools : tools.filter((tool) => !CONTACT_TOOL_NAMES.has(tool.name));
}

export type ContactToolDeps = {
  prisma: Pick<PrismaClient, "contact">;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
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
    if (name === "contacts_save") {
      // The tool never updates by id: it matches by email, like the user's own list.
      const { id: _id, ...rest } = args;
      const input = ContactSaveInputSchema.safeParse(rest);
      if (!input.success) return { error: input.error.issues.map((i) => i.message).join("; ") };
      return { contact: await saveContact(deps.prisma, deps.scope, input.data) };
    }
    return { error: `Unknown contact tool ${name}` };
  } catch {
    return { error: "Contact tool failed" };
  }
}
