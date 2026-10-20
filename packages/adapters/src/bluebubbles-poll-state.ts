import type { PrismaClient } from "@rakazo/db";
import { acquirePollLease, advancePollCursor } from "@rakazo/db";
import type { BlueBubblesPollState } from "./bluebubbles-adapter.js";

/** Poll cursor and lease in Postgres, so every API replica shares one position. */
export function createBlueBubblesPollState(
  prisma: Pick<PrismaClient, "messagingPollCursor">,
  provider = "bluebubbles",
): BlueBubblesPollState {
  return {
    async acquire(leaseMs) {
      const lease = await acquirePollLease(prisma, provider, leaseMs);
      return lease ? { cursorMs: lease.cursorMs } : undefined;
    },
    advance: (cursorMs) => advancePollCursor(prisma, provider, cursorMs),
  };
}
