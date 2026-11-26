import { ORPCError } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { isSpaceOwnerOrAdminRole, isSpaceOwnerRole } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

export { isSpaceOwnerOrAdminRole, isSpaceOwnerRole };

export async function requireSpaceOwner(prisma: PrismaClient, actor: Actor): Promise<void> {
  const membership = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
    select: { role: true },
  });
  if (!isSpaceOwnerRole(membership?.role)) throw new ORPCError("FORBIDDEN");
}
