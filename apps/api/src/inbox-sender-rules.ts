import { removeSenderRules } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { InboxDeps } from "./inbox.js";
import { mailContext } from "./inbox.js";

/**
 * Deletes the Gmail filters made for a sender, on every account of the caller, once the sender is
 * marked important. A filter archives all the sender's mail, including what Praci would keep in
 * the inbox. Returns how many filters could not be deleted; those decisions keep their `ruleId`.
 */
export async function removeFiltersOfSender(
  deps: InboxDeps & { mailWritesDisabled?: boolean },
  actor: Actor,
  senderAddress: string,
  operationId: string,
  signal?: AbortSignal,
): Promise<number> {
  const { prisma } = deps;
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const withRule = await prisma.mailSenderDecision.findMany({
    where: { ...scope, senderAddress, ruleId: { not: null } },
  });
  if (withRule.length === 0) return 0;
  const context = mailContext(actor, operationId, signal);
  const accounts = await deps.mail.listAccounts(scope, context);
  let failed = 0;
  for (const account of accounts) {
    const mine = withRule.filter((d) => d.connectionId === account.id);
    if (mine.length === 0) continue;
    const removal = await removeSenderRules(
      { prisma, mail: deps.mail, writesDisabled: deps.mailWritesDisabled },
      account,
      context,
      mine,
    );
    failed += removal.failed;
  }
  // A decision whose account is not connected any more cannot be reached.
  return failed + withRule.filter((d) => !accounts.some((a) => a.id === d.connectionId)).length;
}
