import { actorScope } from "@rakazo/contracts";
import { equityCapTableByStakeholder } from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.views.capTableByStakeholder. */
export function byStakeholderRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    capTableByStakeholder: authed.equity.views.capTableByStakeholder.handler(({ context, input }) =>
      equityCall(() => equityCapTableByStakeholder(prisma, actorScope(context.actor), input)),
    ),
  };
}
