import type { InboxDeps } from "./inbox.js";

type Actor = Parameters<typeof import("./inbox.js").inboxGet>[1];

export async function inboxComposePrefill(
  _deps: InboxDeps,
  _actor: Actor,
  _input: { messageId: string; mode: "reply" | "replyAll" | "forward" },
): Promise<{
  connectionId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
}> {
  throw new Error("not implemented");
}

interface ComposeFields {
  clientId: string;
  connectionId: string;
  replyToMessageId?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}
type ComposeStatus = { status: "saved" | "sent" | "unknown" | "reconnect" | "disabled" | "failed" };

export async function inboxComposeDraftSave(
  _deps: InboxDeps & { mailWritesDisabled?: boolean },
  _actor: Actor,
  _input: ComposeFields,
): Promise<ComposeStatus> {
  throw new Error("not implemented");
}

export async function inboxComposeSend(
  _deps: InboxDeps & { mailWritesDisabled?: boolean },
  _actor: Actor,
  _input: ComposeFields,
): Promise<ComposeStatus> {
  throw new Error("not implemented");
}

export async function inboxComposeDiscard(
  _deps: InboxDeps,
  _actor: Actor,
  _input: { clientId: string },
): Promise<{ ok: true }> {
  throw new Error("not implemented");
}
