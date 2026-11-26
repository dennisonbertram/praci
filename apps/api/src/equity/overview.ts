import { ORPCError } from "@orpc/server";
import { actorScope } from "@rakazo/contracts";
import { equityOverview, getCapTableSnapshot, importEquitySnapshot } from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.overview and equity.importSnapshot. */
export function overviewRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    overview: authed.equity.overview.handler(({ context, input }) =>
      equityCall(() => equityOverview(prisma, actorScope(context.actor), input)),
    ),
    importSnapshot: authed.equity.importSnapshot.handler(({ context }) =>
      equityCall(async () => {
        const scope = actorScope(context.actor);
        const snapshot = await getCapTableSnapshot(prisma, scope);
        if (!snapshot)
          throw new ORPCError("BAD_REQUEST", { message: "There is no cap table to copy" });
        return importEquitySnapshot(prisma, scope, snapshot);
      }),
    ),
  };
}
