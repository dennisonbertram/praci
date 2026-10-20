import { InboxPileSchema, MailSignalsSchema } from "@rakazo/contracts";
import type { LearnedPile, LearnVote } from "@rakazo/core";
import { classifyPile, learnSenderPile, resolvePile, senderMarkMap } from "@rakazo/core";
import type { Prisma } from "@rakazo/db";
import type { SenderScope } from "./mail-sender-stats.js";

/**
 * Runs the free pile rules over a connection's windowed, received mail (inbox and spam) and stores
 * the result: `rulePile` and `ruleReasons` from the rules, `pile` as the rules' pile or else the
 * model's category mapped to a pile. Every sync recomputes, so a changed sender mark or a resolved
 * prior-contact check takes effect without version tracking. Only rows whose answer changed are written.
 * It also learns a sender's pile from the model's verdicts (see `learnSenderPile`) and feeds it back
 * into the rules in the same pass.
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
      receivedAt: true,
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
      select: {
        senderAddress: true,
        priorContact: true,
        learnedPile: true,
        learnedCount: true,
        learnedForgottenAt: true,
      },
    }),
    tx.mailSenderDecision.findMany({
      where: { spaceId, userId, connectionId, skipInboxAt: { not: null } },
      select: { senderAddress: true },
    }),
  ]);
  const skipped = new Set(skipping.map((decision) => decision.senderAddress));
  const marks = senderMarkMap(feedback);
  const statByAddress = new Map(stats.map((stat) => [stat.senderAddress, stat]));
  const prior = new Map(stats.map((stat) => [stat.senderAddress, stat.priorContact]));

  const parsedSignals = new Map(
    rows.map((row) => {
      const parsed = MailSignalsSchema.safeParse(row.signals);
      return [row.id, parsed.success ? parsed.data : null] as const;
    }),
  );
  const votesBySender = new Map<string, LearnVote[]>();
  for (const row of rows) {
    const address = row.fromAddress.toLowerCase();
    const votes = votesBySender.get(address) ?? [];
    votes.push({
      category: row.category,
      modelDecided: row.rulePile === null || row.ruleReasons.includes("learned_sender"),
      signals: parsedSignals.get(row.id) ?? null,
      receivedAt: row.receivedAt,
      notSpam: row.notSpamAt !== null,
      ruleIsSpam: row.rulePile === "spam",
    });
    votesBySender.set(address, votes);
  }
  const learned = new Map<string, LearnedPile | null>();
  for (const [address, votes] of votesBySender) {
    const stat = statByAddress.get(address);
    if (!stat) continue;
    const stored = InboxPileSchema.safeParse(stat.learnedPile);
    const storedPile = stored.success && stored.data !== "spam" ? stored.data : null;
    const result = learnSenderPile(votes, {
      mark: marks.get(address) ?? null,
      priorContact: stat.priorContact,
      skipInbox: skipped.has(address),
      forgottenAt: stat.learnedForgottenAt,
      current: storedPile,
    });
    if ("keep" in result) {
      learned.set(address, storedPile);
      continue;
    }
    learned.set(address, result.pile);
    if (result.pile === storedPile && result.count === stat.learnedCount) continue;
    await tx.mailSenderStat.updateMany({
      where: { spaceId, userId, connectionId, senderAddress: address },
      data: {
        learnedPile: result.pile,
        learnedCount: result.count,
        ...(result.pile === storedPile ? {} : { learnedAt: result.pile ? new Date() : null }),
      },
    });
  }

  // Rows that end with the same answer are written together.
  const groups = new Map<
    string,
    { rulePile: string | null; ruleReasons: string[]; pile: string | null; ids: string[] }
  >();
  for (const row of rows) {
    const address = row.fromAddress.toLowerCase();
    const decision = classifyPile({
      fromName: row.fromName,
      fromAddress: address,
      subject: row.subject,
      signals: parsedSignals.get(row.id) ?? null,
      senderMark: marks.get(address) ?? null,
      priorContact: prior.get(address) ?? null,
      skipInbox: skipped.has(address),
      learnedPile: learned.get(address) ?? null,
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
