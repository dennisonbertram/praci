import type { FragmentDelta } from "@rakazo/core";
import type { PrismaClient } from "./client.js";

const HASH_BYTES = 16;

type RunRef = { id: string; spaceId: string; userId: string };

/** Add what a run read since the last call, only while this worker still holds the run's lease. */
export async function appendRunFragments(
  prisma: PrismaClient,
  run: RunRef,
  leaseOwner: string,
  fence: number,
  keyId: string,
  delta: FragmentDelta,
): Promise<void> {
  const entries = Buffer.concat(
    delta.entries.map(({ tag, hash }) =>
      Buffer.concat([Buffer.from([tag]), Buffer.from(hash, "hex")]),
    ),
  );
  await prisma.$transaction(async (tx) => {
    // Same fence as the turn checkpoint: a worker whose lease moved on cannot add rows.
    const locked = await tx.run.updateMany({
      where: {
        id: run.id,
        spaceId: run.spaceId,
        status: "running",
        leaseOwner,
        leaseFence: fence,
      },
      data: { leaseFence: fence },
    });
    if (locked.count !== 1) throw new Error("Run lease expired before recording fragments");
    await tx.runFragment.create({
      data: {
        runId: run.id,
        spaceId: run.spaceId,
        userId: run.userId,
        fence,
        keyId,
        entries,
        publicWords: delta.publicWords,
      },
    });
  });
}

/** Every stored row of the run, in the order written. */
export async function loadRunFragments(
  prisma: PrismaClient,
  run: { id: string; spaceId: string },
): Promise<Array<FragmentDelta & { keyId: string }>> {
  const rows = await prisma.runFragment.findMany({
    where: { runId: run.id, spaceId: run.spaceId },
    orderBy: { id: "asc" },
    select: { keyId: true, entries: true, publicWords: true },
  });
  return rows.map((row) => {
    const bytes = Buffer.from(row.entries);
    const entries: FragmentDelta["entries"] = [];
    for (let at = 0; at + 1 + HASH_BYTES <= bytes.length; at += 1 + HASH_BYTES) {
      entries.push({
        tag: bytes[at]!,
        hash: bytes.subarray(at + 1, at + 1 + HASH_BYTES).toString("hex"),
      });
    }
    return { keyId: row.keyId, entries, publicWords: row.publicWords };
  });
}

export async function clearRunFragments(
  prisma: Pick<PrismaClient, "runFragment">,
  runIds: readonly string[],
): Promise<void> {
  if (runIds.length === 0) return;
  await prisma.runFragment.deleteMany({ where: { runId: { in: [...runIds] } } });
}
