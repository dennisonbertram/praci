import { ORPCError } from "@orpc/server";
import type { JobPublisher } from "@rakazo/adapter-kit";
import { pipelineImportJob } from "@rakazo/adapter-kit";
import type { Actor, PipelineImportCard } from "@rakazo/contracts";
import { MessageBlock as MessageBlockSchema } from "@rakazo/contracts";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { readPipelineImportCard } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

type Target = { threadId: string };
type CardInput = { runId: string; messageId: string };

export type PipelineImportDeps = {
  prisma: PrismaClient;
  jobs: Pick<JobPublisher, "enqueue">;
  events: Pick<ThreadEvents, "acceptPipelineImport">;
};

/** `threads.pipelineImport`: the card, only for the run's own user. */
export async function readPipelineImport(
  deps: Pick<PipelineImportDeps, "prisma">,
  actor: Actor,
  target: Target,
  input: CardInput,
): Promise<PipelineImportCard> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const run = await deps.prisma.run.findFirst({
    where: { id: input.runId, threadId: target.threadId, ...scope },
    select: { id: true },
  });
  const message = run
    ? await deps.prisma.message.findFirst({
        where: { id: input.messageId, threadId: target.threadId, runId: input.runId, role: "bot" },
      })
    : null;
  const blocks = MessageBlockSchema.array().safeParse(message?.blocks);
  const block = blocks.success
    ? blocks.data.find((item) => item.kind === "ask" && item.pipelineImport)
    : undefined;
  const card =
    block?.kind === "ask" && block.pipelineImport && block.approvalEffectId
      ? await readPipelineImportCard(
          deps.prisma,
          scope,
          block.pipelineImport.importId,
          block.approvalEffectId,
        )
      : null;
  if (!card) throw new ORPCError("NOT_FOUND", { message: "Not found" });
  return card;
}

/** Add, from the web and desktop card. The worker applies the rows; the card reads the result. */
export async function applyPipelineImport(
  deps: PipelineImportDeps,
  actor: Actor,
  target: Target,
  input: CardInput & { hash: string; answers: Record<string, string> },
): Promise<void> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const accepted = await deps.events.acceptPipelineImport({
    ...scope,
    threadId: target.threadId,
    runId: input.runId,
    messageId: input.messageId,
    hash: input.hash,
    answers: input.answers,
  });
  if (accepted.status === "changed") {
    throw new ORPCError("CONFLICT", { message: "This list changed. Review it again." });
  }
  if (accepted.status === "unanswered") {
    throw new ORPCError("BAD_REQUEST", { message: "Some answers are left to choose." });
  }
  if (accepted.status === "refused") {
    throw new ORPCError("FORBIDDEN", { message: "This agent cannot add a list." });
  }
  if (accepted.status === "closed") {
    throw new ORPCError("CONFLICT", { message: "This prompt is no longer awaiting an answer" });
  }
  // The rows are durable; a missed enqueue is repaired by the reconciler.
  await deps.jobs
    .enqueue(pipelineImportJob({ importId: accepted.importId, ...scope }))
    .catch((error) => getLogger().error("pipeline import enqueue", error));
}
