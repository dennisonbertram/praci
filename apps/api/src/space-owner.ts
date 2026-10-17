import { ORPCError } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

/** Better Auth stores multiple roles comma-joined, so "owner,admin" is an owner. */
export function isSpaceOwnerRole(role: string | null | undefined): boolean {
  return role?.split(",").some((r) => r.trim() === "owner") ?? false;
}

export async function requireSpaceOwner(prisma: PrismaClient, actor: Actor): Promise<void> {
  const membership = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
    select: { role: true },
  });
  if (!isSpaceOwnerRole(membership?.role)) throw new ORPCError("FORBIDDEN");
}
