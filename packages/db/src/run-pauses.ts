import type { RealtimeFanout } from "@rakazo/adapter-kit";
import {
  AI_CONSENT_EFFECT_KIND,
  AI_DISCLOSURE_VERSION,
  encodeLoginSecret,
  LoginSecretValue,
  MessageBlock as MessageBlockSchema,
} from "@rakazo/contracts";
import {
  callIdFromClientNonce,
  isApprovalAskBlock,
  isConversationalRun,
  isSecretAskBlock,
  resolveAskChoice,
} from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import type {
  AnswerRunInput,
  PauseRunForInput,
  PauseRunForTakeover,
  RunSecretWriter,
} from "./events.js";
import {
  appendEventInTransaction,
  MAIL_APPROVAL_TOOLS,
  mailApprovalComposeClientId,
  notifyRealtime,
} from "./events.js";
import { createThreadMessageInTransaction } from "./messages.js";

const CHOICE_ASK_CHECKPOINT_KIND = "choice_ask_v1";

function choiceAskCheckpoint(actions: Array<{ id: string; label: string }>): string {
  return JSON.stringify({ kind: CHOICE_ASK_CHECKPOINT_KIND, actions });
}

function resumeChoiceLabel(
  selected: { id: string; label: string },
  checkpoint: string | null | undefined,
): string {
  if (!checkpoint) return selected.label;
  try {
    const parsed = JSON.parse(checkpoint) as {
      kind?: string;
      actions?: Array<{ id?: unknown; label?: unknown }>;
    };
    if (parsed.kind !== CHOICE_ASK_CHECKPOINT_KIND || !Array.isArray(parsed.actions)) {
      return selected.label;
    }
    const offered = parsed.actions.find((action) => action.id === selected.id);
    return typeof offered?.label === "string" && offered.label.length > 0
      ? offered.label
      : selected.label;
  } catch {
    return selected.label;
  }
}

/**
 * A conversational run's request and earlier answers stay in thread history, so its resumed
 * attempt gets just the answer. A background run's prompt never reaches the thread, so it keeps
 * its instructions and every earlier answer; otherwise the resumed attempt forgets them.
 */
function resumePrompt(
  run: { trigger: string; task?: { prompt: string } | null },
  question: string,
  answer: string,
): string {
  if (isConversationalRun(run.trigger)) return answer;
  return [run.task?.prompt.trim(), `${question.trim()}\nAnswer: ${answer}`]
    .filter(Boolean)
    .join("\n\n");
}

async function findPendingAsk(
  tx: Prisma.TransactionClient,
  input: { threadId: string; runId: string },
) {
  const messages = await tx.message.findMany({
    where: {
      threadId: input.threadId,
      runId: input.runId,
      role: "bot",
    },
    orderBy: { seq: "desc" },
    take: 50,
    select: { id: true, blocks: true },
  });
  for (const message of messages) {
    const parsed = MessageBlockSchema.array().safeParse(message.blocks);
    if (!parsed.success) continue;
    const pendingAsk = parsed.data.find(
      (block) => block.kind === "ask" && block.status !== "answered",
    );
    if (pendingAsk?.kind === "ask") return { messageId: message.id, pendingAsk };
  }
  return null;
}

/** The recipient and disclosure version the executor stored on an AI data sharing request. */
function consentRequest(request: unknown): { recipientKey: string; version: string } | null {
  const { recipientKey, version } = (request ?? {}) as Record<string, unknown>;
  return typeof recipientKey === "string" && typeof version === "string"
    ? { recipientKey, version }
    : null;
}

async function commitAnswerRunInput(
  tx: Prisma.TransactionClient,
  input: AnswerRunInput,
  runSecretWriter?: RunSecretWriter,
): Promise<{ threadId: string; seq: number } | null> {
  // Thread row first, then run rows — the same order as clearThread and finalizeRun, so a
  // concurrent clear cannot deadlock against this transaction.
  await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
  const run = await tx.run.findFirst({
    where: {
      id: input.runId,
      spaceId: input.spaceId,
      threadId: input.threadId,
      status: "waiting_input",
    },
    select: {
      botId: true,
      userId: true,
      checkpoint: true,
      trigger: true,
      task: { select: { prompt: true } },
    },
  });
  if (!run) return null;
  const message = await tx.message.findFirst({
    where: {
      id: input.messageId,
      threadId: input.threadId,
      runId: input.runId,
      role: "bot",
    },
  });
  const parsed = MessageBlockSchema.array().safeParse(message?.blocks);
  if (!message || !parsed.success) return null;
  const pendingAsk = parsed.data.find(
    (block) => block.kind === "ask" && block.status !== "answered",
  );
  if (pendingAsk?.kind !== "ask") return null;
  const approvalAsk = isApprovalAskBlock(pendingAsk);
  const secretAsk = isSecretAskBlock(pendingAsk);
  const choiceAsk = !approvalAsk && !secretAsk && Boolean(pendingAsk.actions?.length);
  const selectedChoice = choiceAsk ? resolveAskChoice(input.answer, pendingAsk.actions) : undefined;
  if (secretAsk && !runSecretWriter) return null;
  if (secretAsk && pendingAsk.credential && run.userId !== input.answeredByUserId) return null;
  const loginAsk = secretAsk && pendingAsk.credential?.auth.type === "login";
  // A username belongs only to a login card, which cannot be saved without one.
  if (loginAsk !== Boolean(input.username?.trim())) return null;
  const login = loginAsk
    ? LoginSecretValue.safeParse({ username: input.username!.trim(), password: input.answer })
    : undefined;
  if (login && !login.success) return null;
  let approvalEffect: { id: string; kind: string; request?: unknown } | null = null;
  let approvalUserId: string | null = null;
  if (input.mailDenial && (!approvalAsk || input.answer !== "deny")) return null;

  if (approvalAsk) {
    if (!pendingAsk.actions?.some((action) => action.id === input.answer)) return null;
    approvalEffect = await tx.externalEffect.findFirst({
      where: {
        id: pendingAsk.approvalEffectId,
        spaceId: input.spaceId,
        runId: input.runId,
        status: "intended",
      },
    });
    if (!approvalEffect) return null;
    if (
      input.mailDenial &&
      (run.userId !== input.answeredByUserId || !MAIL_APPROVAL_TOOLS.has(approvalEffect.kind))
    ) {
      return null;
    }
    if (input.answer === "always") {
      if (run.userId !== input.answeredByUserId) return null;
      approvalUserId = input.answeredByUserId;
    }
    // Only the run's owner can answer for their data.
    if (approvalEffect.kind === AI_CONSENT_EFFECT_KIND && run.userId !== input.answeredByUserId) {
      return null;
    }
  }
  // An Allow for a disclosure that has since changed grants nothing. It resumes the run as Not now,
  // so the run is never stranded; the next mail read asks again under the current version.
  const staleConsent =
    approvalAsk &&
    approvalEffect!.kind === AI_CONSENT_EFFECT_KIND &&
    input.answer === "allow" &&
    consentRequest(approvalEffect!.request)?.version !== AI_DISCLOSURE_VERSION;

  const queued = await tx.run.updateMany({
    where: {
      id: input.runId,
      spaceId: input.spaceId,
      threadId: input.threadId,
      status: "waiting_input",
    },
    data: {
      status: "queued",
      ...(choiceAsk ? { checkpoint: null } : {}),
    },
  });
  if (queued.count !== 1) return null;

  const recordedAnswer = secretAsk
    ? ""
    : staleConsent
      ? "deny"
      : (selectedChoice?.id ?? input.answer);
  const callId = callIdFromClientNonce(input.clientNonce);
  const recordsCallUtterance = Boolean(callId && !secretAsk);

  // Give spoken answers the same durable, call-scoped user utterance as other voice turns.
  // Secret asks stay out of message history; the call UI requires those answers on screen.
  if (recordsCallUtterance) {
    const blocks = [{ kind: "text" as const, text: input.answer }];
    const utterance = await createThreadMessageInTransaction(tx, {
      threadId: input.threadId,
      role: "user",
      blocks,
      botId: run.botId,
      runId: input.runId,
      clientNonce: input.clientNonce,
    });
    await appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: run.botId,
      type: "thread.message.created",
      runId: input.runId,
      payload: { messageId: utterance.id, role: "user", blocks, callId },
    });
  }

  if (approvalAsk) {
    const allowed = (input.answer === "allow" || input.answer === "always") && !staleConsent;
    const consent = approvalEffect!.kind === AI_CONSENT_EFFECT_KIND;
    if (consent && allowed) {
      const recipientKey = consentRequest(approvalEffect!.request)!.recipientKey;
      await tx.aiDataConsent.upsert({
        where: {
          userId_spaceId_recipientKey: {
            userId: run.userId,
            spaceId: input.spaceId,
            recipientKey,
          },
        },
        create: {
          userId: run.userId,
          spaceId: input.spaceId,
          recipientKey,
          version: AI_DISCLOSURE_VERSION,
        },
        update: { version: AI_DISCLOSURE_VERSION, grantedAt: new Date() },
      });
    }
    await tx.externalEffect.update({
      where: { id: approvalEffect!.id },
      data: {
        status: allowed ? "approved" : "denied",
        ...(input.mailDenial ? { result: { note: input.mailDenial.note } } : {}),
      },
    });
    // The person's own send is recorded in the same commit as the claim, so a crash before the
    // provider call still leaves a durable record for the reconciler to settle the card from.
    const connectionId = input.mailDenial?.mail.connectionId;
    if (input.mailDenial && connectionId) {
      const key = {
        spaceId: input.spaceId,
        userId: input.answeredByUserId,
        clientId: mailApprovalComposeClientId(approvalEffect!.id),
      };
      await tx.composeSend.upsert({
        where: { spaceId_userId_clientId: key },
        create: { ...key, connectionId },
        update: {},
      });
    }
    if (input.answer === "always") {
      await tx.actionApprovalRule.upsert({
        where: {
          spaceId_createdByUserId_effect_matchKind_matchValue: {
            spaceId: input.spaceId,
            createdByUserId: approvalUserId!,
            effect: "always_allow",
            matchKind: "tool",
            matchValue: approvalEffect!.kind,
          },
        },
        create: {
          spaceId: input.spaceId,
          createdByUserId: approvalUserId!,
          effect: "always_allow",
          matchKind: "tool",
          matchValue: approvalEffect!.kind,
        },
        update: {},
      });
    }
  } else if (secretAsk) {
    await runSecretWriter!.store({
      botId: run.botId,
      credential: pendingAsk.credential,
      runId: input.runId,
      userId: run.userId,
      spaceId: input.spaceId,
      plaintext: login?.success ? encodeLoginSecret(login.data) : input.answer,
      tx,
    });
    await tx.externalEffect.updateMany({
      where: {
        runId: input.runId,
        spaceId: input.spaceId,
        kind: "request_secret",
        status: "intended",
      },
      data: {
        status: "approved",
        ...(pendingAsk.credential ? { result: { credentialSaved: pendingAsk.credential } } : {}),
      },
    });
  } else {
    const resumeLabel = selectedChoice
      ? resumeChoiceLabel(selectedChoice, run.checkpoint)
      : undefined;
    const task = await tx.task.updateMany({
      where: { runs: { some: { id: input.runId } } },
      data: {
        prompt: resumePrompt(
          run,
          pendingAsk.text,
          selectedChoice ? `Selected choice ${selectedChoice.id}: ${resumeLabel}` : input.answer,
        ),
      },
    });
    if (task.count !== 1) throw new Error("Run task was not available to answer");
  }

  const blocks = parsed.data.map((block) =>
    block === pendingAsk
      ? {
          ...block,
          status: "answered" as const,
          answer: recordedAnswer,
          ...(input.mailDenial && block.mail
            ? { mail: { ...block.mail, ...input.mailDenial.mail } }
            : {}),
        }
      : block,
  );
  await tx.message.update({ where: { id: message.id }, data: { blocks } });
  const updated = await appendEventInTransaction(tx, {
    spaceId: input.spaceId,
    threadId: input.threadId,
    botId: run.botId,
    type: "thread.message.updated",
    runId: input.runId,
    payload: { messageId: message.id, role: "bot", blocks },
  });
  return { threadId: updated.threadId, seq: updated.seq };
}

export async function answerRunInput(
  prisma: PrismaClient,
  input: AnswerRunInput,
  realtime?: RealtimeFanout,
  runSecretWriter?: RunSecretWriter,
): Promise<boolean> {
  const commit = (writer = runSecretWriter) =>
    prisma.$transaction(async (tx: Prisma.TransactionClient) =>
      commitAnswerRunInput(tx, input, writer),
    );
  const committed = runSecretWriter?.withPrepared
    ? await runSecretWriter.withPrepared(prisma, input, commit)
    : await commit();

  if (!committed) return false;
  await notifyRealtime(realtime, committed.threadId, committed.seq);
  return true;
}

/** Answer a waiting question ask with composer free-text. Approval and secret cards stay on the card path. */
export async function answerWaitingRunWithTextInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    spaceId: string;
    threadId: string;
    runId: string;
    answeredByUserId: string;
    answer: string;
  },
): Promise<{ threadId: string; seq: number } | null> {
  const answer = input.answer.trim();
  if (!answer) return null;
  const found = await findPendingAsk(tx, input);
  if (!found) return null;
  if (isApprovalAskBlock(found.pendingAsk) || isSecretAskBlock(found.pendingAsk)) return null;
  return commitAnswerRunInput(tx, { ...input, messageId: found.messageId, answer });
}

export async function pauseRunForInput(
  prisma: PrismaClient,
  input: PauseRunForInput,
  realtime?: RealtimeFanout,
): Promise<boolean> {
  const committed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Thread row first, then run rows — the same order as clearThread and finalizeRun, so a
    // concurrent clear cannot deadlock against this transaction.
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
    const paused = await tx.run.updateMany({
      where: {
        id: input.runId,
        spaceId: input.spaceId,
        threadId: input.threadId,
        botId: input.botId,
        status: "running",
        leaseOwner: input.leaseOwner,
        leaseFence: input.leaseFence,
      },
      data: {
        status: "waiting_input",
        leaseOwner: null,
        leaseExpiresAt: null,
        ...(input.offeredActions?.length
          ? { checkpoint: choiceAskCheckpoint(input.offeredActions) }
          : {}),
      },
    });
    if (paused.count !== 1) return null;

    const attempt = await tx.attempt.updateMany({
      where: {
        id: input.attemptId,
        runId: input.runId,
        fence: input.leaseFence,
        status: "running",
      },
      data: { status: "waiting_input", finishedAt: new Date() },
    });
    if (attempt.count !== 1) throw new Error("Active run attempt was not available to pause");

    const message = await createThreadMessageInTransaction(tx, {
      threadId: input.threadId,
      role: "bot",
      blocks: input.blocks,
      botId: input.botId,
      runId: input.runId,
    });
    await appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      type: "thread.message.created",
      runId: input.runId,
      payload: { messageId: message.id, role: "bot", blocks: input.blocks },
    });
    const waitingEvent = await appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      type: "run.waiting_input",
      runId: input.runId,
      payload: {},
    });
    await tx.event.deleteMany({ where: { runId: input.runId, type: "thread.progress" } });
    return { threadId: waitingEvent.threadId, seq: waitingEvent.seq };
  });

  if (!committed) return false;
  await notifyRealtime(realtime, committed.threadId, committed.seq);
  return true;
}

export async function pauseRunForTakeover(
  prisma: PrismaClient,
  input: PauseRunForTakeover,
  realtime?: RealtimeFanout,
): Promise<boolean> {
  const committed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
    const paused = await tx.run.updateMany({
      where: {
        id: input.runId,
        spaceId: input.spaceId,
        threadId: input.threadId,
        botId: input.botId,
        status: "running",
        leaseOwner: input.leaseOwner,
        leaseFence: input.leaseFence,
      },
      data: {
        status: "waiting_takeover",
        leaseOwner: null,
        leaseExpiresAt: null,
        checkpoint: null,
      },
    });
    if (paused.count !== 1) return null;

    const attempt = await tx.attempt.updateMany({
      where: {
        id: input.attemptId,
        runId: input.runId,
        fence: input.leaseFence,
        status: "running",
      },
      data: { status: "waiting_takeover", finishedAt: new Date() },
    });
    if (attempt.count !== 1) throw new Error("Active run attempt was not available to pause");

    const now = new Date();
    // Serialize with concurrent computer/takeover grants that mutate the same row.
    await tx.$queryRaw`
      SELECT id FROM computers WHERE id = ${input.computerId} AND "spaceId" = ${input.spaceId} FOR UPDATE`;
    const computer = await tx.computer.findFirst({
      where: { id: input.computerId, spaceId: input.spaceId },
      select: {
        controlHolder: true,
        controlBotId: true,
        controlLeaseId: true,
        controlLeaseExpiresAt: true,
      },
    });
    const activeUserLease = Boolean(
      computer?.controlHolder === "user" &&
        computer.controlLeaseId &&
        computer.controlLeaseExpiresAt &&
        computer.controlLeaseExpiresAt.getTime() > now.getTime(),
    );
    // Keep an active same-bot user lease so Skip / I'm done appear immediately.
    // Preserve another bot's active lease — computer/takeover owns revocation. Do not attach
    // this run to that lease: release validates controlBotId and could clear the binding without
    // resuming the waiting run. The requesting bot's takeover flow binds it after revocation.
    // Otherwise clear stale control, but bind controlRunId so takeoverRequested is true.
    const retainControl = Boolean(activeUserLease && computer?.controlBotId === input.botId);
    const preserveForeignLease = Boolean(
      activeUserLease && computer?.controlBotId && computer.controlBotId !== input.botId,
    );
    const marked = await tx.computer.updateMany({
      where: { id: input.computerId, spaceId: input.spaceId },
      data: retainControl
        ? { state: "running", controlRunId: input.runId }
        : preserveForeignLease
          ? { state: "running" }
          : {
              state: "running",
              controlHolder: "none",
              controlLeaseId: null,
              controlLeaseExpiresAt: null,
              controlBotId: null,
              controlRunId: input.runId,
            },
    });
    if (marked.count !== 1) throw new Error("Computer was not available to mark for takeover");

    const waitingEvent = await appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      type: "computer.takeover.requested",
      runId: input.runId,
      payload: {
        reason: input.reason,
        takeoverRequested: true,
        retainedControl: retainControl,
      },
    });
    await tx.event.deleteMany({ where: { runId: input.runId, type: "thread.progress" } });
    return { threadId: waitingEvent.threadId, seq: waitingEvent.seq };
  });

  if (!committed) return false;
  await notifyRealtime(realtime, committed.threadId, committed.seq);
  return true;
}
