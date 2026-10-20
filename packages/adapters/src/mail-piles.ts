import { MailSignalsSchema } from "@rakazo/contracts";
import { classifyPile, resolvePile, senderMarkMap } from "@rakazo/core";
import type { Prisma } from "@rakazo/db";
import type { SenderScope } from "./mail-sender-stats.js";

/**
 * Runs the free pile rules over a connection's windowed, received mail (inbox and spam) and stores
 * the result: `rulePile` and `ruleReasons` from the rules, `pile` as the rules' pile or else the
 * model's category mapped to a pile. Every sync recomputes, so a changed sender mark or a resolved
 * prior-contact check takes effect without version tracking. Only rows whose answer changed are written.
 */
export async function applyPileRules(
  tx: Prisma.TransactionClient,
  scope: SenderScope,
  windowStart: Date,
): Promise<void> {
  const { spaceId, userId, connectionId } = scope;
  const rows = await tx.cachedMailMessage.findMany({
    where: {
      spaceId,
      userId,
      connectionId,
      fromSelf: false,
      receivedAt: { gte: windowStart },
      OR: [{ inInbox: true }, { isSpam: true }],
    },
    select: {
      id: true,
      fromName: true,
      fromAddress: true,
      subject: true,
      signals: true,
      category: true,
      rulePile: true,
      ruleReasons: true,
      pile: true,
      notSpamAt: true,
    },
  });
  if (rows.length === 0) return;
  const senders = [...new Set(rows.map((row) => row.fromAddress.toLowerCase()))];
  const [feedback, stats, skipping] = await Promise.all([
    tx.inboxSenderFeedback.findMany({
      where: { spaceId, userId },
      select: { senderAddress: true, mark: true },
    }),
    tx.mailSenderStat.findMany({
      where: { spaceId, userId, connectionId, senderAddress: { in: senders } },
      select: { senderAddress: true, priorContact: true },
    }),
    tx.mailSenderDecision.findMany({
      where: { spaceId, userId, connectionId, skipInboxAt: { not: null } },
      select: { senderAddress: true },
    }),
  ]);
  const skipped = new Set(skipping.map((decision) => decision.senderAddress));
  const marks = senderMarkMap(feedback);
  const prior = new Map(stats.map((stat) => [stat.senderAddress, stat.priorContact]));

  // Rows that end with the same answer are written together.
  const groups = new Map<
    string,
    { rulePile: string | null; ruleReasons: string[]; pile: string | null; ids: string[] }
  >();
  for (const row of rows) {
    const address = row.fromAddress.toLowerCase();
    const parsed = MailSignalsSchema.safeParse(row.signals);
    const decision = classifyPile({
      fromName: row.fromName,
      fromAddress: address,
      subject: row.subject,
      signals: parsed.success ? parsed.data : null,
      senderMark: marks.get(address) ?? null,
      priorContact: prior.get(address) ?? null,
      skipInbox: skipped.has(address),
    });
    const rulePile = decision.pile;
    const pile = resolvePile(rulePile, row.category, row.notSpamAt !== null);
    const unchanged =
      row.rulePile === rulePile &&
      row.pile === pile &&
      row.ruleReasons.length === decision.reasons.length &&
      row.ruleReasons.every((reason, index) => reason === decision.reasons[index]);
    if (unchanged) continue;
    const key = JSON.stringify([rulePile, decision.reasons, pile]);
    const group = groups.get(key) ?? {
      rulePile,
      ruleReasons: decision.reasons,
      pile,
      ids: [],
    };
    group.ids.push(row.id);
    groups.set(key, group);
  }
  for (const { ids, ...data } of groups.values()) {
    await tx.cachedMailMessage.updateMany({ where: { id: { in: ids }, spaceId, userId }, data });
  }
}
