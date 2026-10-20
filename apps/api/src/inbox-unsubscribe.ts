import type { MailUnsubscriber } from "@rakazo/adapter-kit";
import type {
  Actor,
  ComposeFields,
  UnsubscribeInput,
  UnsubscribeOutput,
  UnsubscribeStatus,
} from "@rakazo/contracts";
import { parseUnsubscribeMailto, planUnsubscribe } from "@rakazo/core";
import { getLogger } from "@rakazo/logging";
import { mailContext } from "./inbox.js";
import { ownConnection, senderFacts } from "./inbox-cleanup.js";
import { inboxComposeSend } from "./inbox-compose.js";
import type { ModifyDeps } from "./inbox-modify.js";

export type UnsubscribeDeps = ModifyDeps & {
  /** Sends the one-click POST; without it a one-click sender degrades to its link. */
  unsubscriber?: MailUnsubscriber;
};

/** The unsubscribe attempt worked or may have: from then on the sender skips the inbox. */
const TAKES_EFFECT: UnsubscribeStatus[] = ["done", "opened", "sent", "unknown"];

/**
 * Unsubscribes the caller from one sender, in order: RFC 8058 one click, else the https link for the
 * user to open, else a mailto the user confirmed. Spam-like mail is refused, since unsubscribing
 * confirms the address to the sender. Every attempt is recorded on the sender's decision. The
 * caller archives the sender's mail afterwards with `cleanup.archive`.
 */
export async function inboxUnsubscribe(
  deps: UnsubscribeDeps,
  actor: Actor,
  input: UnsubscribeInput,
  signal?: AbortSignal,
): Promise<UnsubscribeOutput> {
  const { prisma } = deps;
  await ownConnection(prisma, actor, input.connectionId);
  const address = input.address.trim().toLowerCase();
  const scope = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    connectionId: input.connectionId,
  };
  const [facts] = await senderFacts(prisma, actor, [input.connectionId], address, false);
  const plan = planUnsubscribe(facts?.signals ?? null, facts?.spamLike ?? false);

  const record = async (
    status: UnsubscribeStatus,
    method: "one_click" | "link" | "mailto" | null,
  ) => {
    const now = new Date();
    const attempt = { unsubscribeStatus: status, unsubscribeMethod: method, unsubscribedAt: now };
    const decision = await prisma.mailSenderDecision.upsert({
      where: {
        connectionId_senderAddress: { connectionId: input.connectionId, senderAddress: address },
      },
      create: {
        ...scope,
        senderAddress: address,
        ...attempt,
        ...(TAKES_EFFECT.includes(status) ? { skipInboxAt: now } : {}),
      },
      update: attempt,
    });
    if (TAKES_EFFECT.includes(status) && !decision.skipInboxAt)
      await prisma.mailSenderDecision.update({
        where: { id: decision.id },
        data: { skipInboxAt: now },
      });
    return decision;
  };

  if (plan.method === "none") return { status: "unavailable", method: null };
  if (plan.method === "refused") {
    await record("refused", null);
    return { status: "refused", method: null };
  }
  const writesOff = Boolean(deps.mailWritesDisabled);

  if (plan.method === "link" || (plan.method === "one_click" && !deps.unsubscriber)) {
    await record("opened", "link");
    return { status: "opened", method: "link", openUrl: plan.url };
  }

  if (plan.method === "one_click") {
    if (writesOff) return { status: "disabled", method: "one_click" };
    try {
      await (deps.unsubscriber as MailUnsubscriber).oneClick(
        plan.url,
        mailContext(actor, "inbox.unsubscribe", signal),
      );
    } catch (error) {
      getLogger().warn("one-click unsubscribe failed", {
        connectionId: input.connectionId,
        reason: error instanceof Error ? error.name : "error",
      });
      await record("failed", "one_click");
      return { status: "failed", method: "one_click", openUrl: plan.url };
    }
    await record("done", "one_click");
    return { status: "done", method: "one_click" };
  }

  // mailto: an email goes out only after the user confirmed it.
  const mail = parseUnsubscribeMailto(plan.target);
  if (!mail) return { status: "unavailable", method: null };
  if (writesOff) return { status: "disabled", method: "mailto" };
  if (!input.confirmMailto)
    return { status: "needs_confirmation", method: "mailto", mailTo: mail.to };
  // The decision row exists before the send, so its id names the message and a repeat sends nothing.
  const decision = await prisma.mailSenderDecision.upsert({
    where: {
      connectionId_senderAddress: { connectionId: input.connectionId, senderAddress: address },
    },
    create: { ...scope, senderAddress: address },
    update: {},
  });
  const fields: ComposeFields = {
    clientId: `unsub-${decision.id}`,
    connectionId: input.connectionId,
    to: mail.to,
    cc: "",
    bcc: "",
    subject: mail.subject,
    body: mail.body,
  };
  const sent = await inboxComposeSend(deps, actor, fields);
  const status: UnsubscribeStatus =
    sent.status === "sent" ? "sent" : sent.status === "unknown" ? "unknown" : "failed";
  await record(status, "mailto");
  return { status, method: "mailto" };
}
