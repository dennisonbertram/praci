import { ORPCError } from "@orpc/server";
import type { Actor, ComposeFields, ComposeResult, InvestorUpdate } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  attemptKey,
  claimInvestorUpdateRetry,
  claimInvestorUpdateSend,
  finishInvestorUpdateSend,
  getInvestorUpdate,
  recordInvestorAttempt,
  setInvestorUpdateRecipients,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

type Db = Pick<PrismaClient, "investorUpdate" | "contact" | "composeSend" | "space">;

export interface InvestorSendDeps {
  prisma: Db;
  /** Sends one message through the Inbox composer; it records the outcome under `clientId`. */
  compose: (actor: Actor, fields: ComposeFields) => Promise<ComposeResult>;
  /** The caller's connected Gmail connection ids; the first is the default From. */
  gmailConnectionIds: (actor: Actor) => Promise<string[]>;
  mailWritesDisabled?: boolean;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Bold, italic and links inside one line of already escaped text. */
function inline(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}

/** The markdown body as the small HTML the Inbox composer accepts: headings, paragraphs, bullets, bold, italic, links. */
export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(`<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
    if (paragraph.length) out.push(`<p>${paragraph.join("<br>")}</p>`);
    bullets = [];
    paragraph = [];
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = escapeHtml(raw.trim());
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (bullet) {
      if (paragraph.length) flush();
      bullets.push(inline(bullet[1] ?? ""));
    } else if (heading) {
      flush();
      out.push(`<p><strong>${inline(heading[1] ?? "")}</strong></p>`);
    } else {
      if (bullets.length) flush();
      paragraph.push(inline(line));
    }
  }
  flush();
  return out.join("");
}

/** A failed attempt must show as Failed, not Unknown, even when the composer stopped before it wrote a row. */
async function ensureFailedRow(
  deps: InvestorSendDeps,
  actor: Actor,
  clientId: string,
  connectionId: string,
) {
  await deps.prisma.composeSend.upsert({
    where: {
      spaceId_userId_clientId: { spaceId: actor.spaceId, userId: actor.userId, clientId },
    },
    create: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      connectionId,
      clientId,
      state: "failed",
    },
    update: {},
  });
}

type Sendable = Pick<
  NonNullable<Awaited<ReturnType<typeof claimInvestorUpdateSend>>>,
  "id" | "audience" | "subject" | "body" | "fromConnectionId"
>;

/** One message per recipient, one at a time. An attempt is recorded before its message goes out. */
async function sendLoop(
  deps: InvestorSendDeps,
  actor: Actor,
  update: Sendable,
  connectionId: string,
  contactIds: readonly string[],
): Promise<void> {
  try {
    for (const contactId of contactIds) {
      const contact = await deps.prisma.contact.findFirst({
        where: { id: contactId, spaceId: actor.spaceId, userId: actor.userId },
        select: { email: true },
      });
      const n = await recordInvestorAttempt(deps.prisma, actor, update.id, contactId);
      const clientId = attemptKey(update.id, contactId, n);
      try {
        if (!contact?.email) throw new Error("no email");
        const result = await deps.compose(actor, {
          clientId,
          connectionId,
          to: contact.email,
          cc: "",
          bcc: "",
          subject: update.subject,
          body: update.body,
          html: markdownToHtml(update.body),
        });
        if (result.status !== "sent" && result.status !== "unknown")
          await ensureFailedRow(deps, actor, clientId, connectionId);
      } catch (error) {
        getLogger().warn("investor update message not sent", {
          updateId: update.id,
          reason: error instanceof Error ? error.message : "error",
        });
        await ensureFailedRow(deps, actor, clientId, connectionId);
      }
    }
    await finishInvestorUpdateSend(deps.prisma, actor, update.id);
  } catch (error) {
    // The update stays Sending, then reads Partly sent once it stops moving; nothing resumes by itself.
    getLogger().error("investor update send stopped", error, { updateId: update.id });
  }
}

async function senderFor(deps: InvestorSendDeps, actor: Actor, preferred: string | null) {
  if (deps.mailWritesDisabled) throw new ORPCError("BAD_REQUEST", { message: "Sending is off" });
  const ids = await deps.gmailConnectionIds(actor);
  const id = preferred && ids.includes(preferred) ? preferred : ids[0];
  if (!id) throw new ORPCError("BAD_REQUEST", { message: "Connect Gmail to send" });
  return id;
}

/**
 * Send: claims the draft once (a second call changes nothing), then sends in the background, in this
 * process. `done` settles when every recipient has a result; the request does not wait for it.
 */
export async function startInvestorUpdateSend(
  deps: InvestorSendDeps,
  actor: Actor,
  id: string,
): Promise<{ update: InvestorUpdate; done: Promise<void> }> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const current = await getInvestorUpdate(deps.prisma, scope, id);
  if (current.status !== "draft") return { update: current, done: Promise.resolve() };
  const contacts = await deps.prisma.contact.findMany({
    where: { ...scope, id: { in: current.recipientContactIds }, email: { not: null } },
    select: { id: true },
  });
  const emailed = new Set(contacts.map((c) => c.id));
  const recipients = current.recipientContactIds.filter((contactId) => emailed.has(contactId));
  if (recipients.length === 0)
    throw new ORPCError("BAD_REQUEST", { message: "Pick at least one recipient" });
  const connectionId = await senderFor(deps, actor, current.fromConnectionId);
  const claimed = await claimInvestorUpdateSend(deps.prisma, scope, id);
  if (!claimed)
    return { update: await getInvestorUpdate(deps.prisma, scope, id), done: Promise.resolve() };
  // The recipients are read from the claimed row, so an edit made since the check above holds.
  const claimedEmailed = await deps.prisma.contact.findMany({
    where: { ...scope, id: { in: claimed.recipientContactIds }, email: { not: null } },
    select: { id: true },
  });
  const ok = new Set(claimedEmailed.map((c) => c.id));
  const final = claimed.recipientContactIds.filter((contactId) => ok.has(contactId));
  await setInvestorUpdateRecipients(deps.prisma, scope, id, final);
  const done = sendLoop(deps, actor, claimed, connectionId, final);
  return { update: await getInvestorUpdate(deps.prisma, scope, id), done };
}

/** Sends again to failed recipients, and to Unknown ones only when the founder confirmed. */
export async function startInvestorUpdateRetry(
  deps: InvestorSendDeps,
  actor: Actor,
  input: { id: string; contactIds?: string[]; resendUnknown?: boolean },
): Promise<{ update: InvestorUpdate; done: Promise<void> }> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const current = await getInvestorUpdate(deps.prisma, scope, input.id);
  const connectionId = await senderFor(deps, actor, current.fromConnectionId);
  const claim = await claimInvestorUpdateRetry(deps.prisma, scope, input.id, {
    contactIds: input.contactIds,
    resendUnknown: input.resendUnknown,
  });
  if (!claim) return { update: current, done: Promise.resolve() };
  const done = sendLoop(deps, actor, claim.row, connectionId, claim.contactIds);
  return { update: await getInvestorUpdate(deps.prisma, scope, input.id), done };
}
