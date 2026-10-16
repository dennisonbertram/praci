import type { CapTableSnapshot, CapTableSnapshotInput } from "@rakazo/contracts";
import { CapTableSnapshotInputSchema } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "capTableSnapshot">;
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });

/** The user's latest cap table snapshot, or null before the first sync. */
export async function getCapTableSnapshot(
  prisma: Db,
  actor: Scope,
): Promise<CapTableSnapshot | null> {
  const row = await prisma.capTableSnapshot.findUnique({
    where: { spaceId_userId: ownerOf(actor) },
  });
  if (!row) return null;
  const data = CapTableSnapshotInputSchema.safeParse(row.data);
  return data.success ? { ...data.data, updatedAt: row.updatedAt.toISOString() } : null;
}

/** Validates the input and replaces the user's snapshot. Throws a ZodError for invalid input. */
export async function saveCapTableSnapshot(
  prisma: Db,
  actor: Scope,
  input: CapTableSnapshotInput,
): Promise<void> {
  const data = CapTableSnapshotInputSchema.parse(input);
  const scope = ownerOf(actor);
  await prisma.capTableSnapshot.upsert({
    where: { spaceId_userId: scope },
    create: { ...scope, data },
    update: { data },
  });
}
