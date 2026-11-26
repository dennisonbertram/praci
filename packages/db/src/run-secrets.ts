import type { Prisma, PrismaClient } from "./client.js";
import { clearRunFragments } from "./run-fragments.js";
import { clearRunTurnCheckpoints } from "./run-turn-checkpoint.js";

/** A one-time answer longer than a saved value may be. Nothing is stored or echoed. */
export class AnswerTooLongError extends Error {
  constructor() {
    super("This answer is too long.");
    this.name = "AnswerTooLongError";
  }
}

/** A secret card's answer waits under this kind until the resumed run reads it once. */
export function runSecretKind(runId: string): string {
  return `run-secret:${runId}`;
}

/**
 * An ended run never reads its waiting answer, so drop it with the run. The answer is stored
 * under the run's user and space, which also keeps this delete on the secrets index.
 */
export async function deleteRunSecretsInTransaction(
  tx: Pick<Prisma.TransactionClient, "secret">,
  runs: ReadonlyArray<{ id: string; userId: string; spaceId: string }>,
): Promise<void> {
  if (runs.length === 0) return;
  await tx.secret.deleteMany({
    where: {
      OR: runs.map((run) => ({
        userId: run.userId,
        spaceId: run.spaceId,
        kind: runSecretKind(run.id),
      })),
    },
  });
}

/**
 * Drop the waiting one-time answers of runs that ended. Paths that end runs by id read each
 * run's user and space here for the secrets index.
 */
export async function clearEndedRunState(
  prisma: Pick<
    PrismaClient,
    "run" | "secret" | "externalEffect" | "appControlSnapshot" | "runFragment"
  >,
  runIds: readonly string[],
): Promise<void> {
  if (runIds.length === 0) return;
  await clearRunTurnCheckpoints(prisma, runIds);
  await clearRunFragments(prisma, runIds);
  const runs = await prisma.run.findMany({
    where: { id: { in: [...runIds] } },
    select: { id: true, userId: true, spaceId: true },
  });
  await deleteRunSecretsInTransaction(prisma, runs);
  // Snapshot ownership for desktop app control lives only as long as the run.
  if (runs.length > 0) {
    await prisma.appControlSnapshot.deleteMany({
      where: {
        OR: runs.map((run) => ({ runId: run.id, spaceId: run.spaceId, userId: run.userId })),
      },
    });
  }
}
