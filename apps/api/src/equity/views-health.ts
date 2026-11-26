import { actorScope } from "@rakazo/contracts";
import { runEquityHealthChecks } from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.views.runHealthChecks. */
export function healthRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    runHealthChecks: authed.equity.views.runHealthChecks.handler(({ context, input }) =>
      equityCall(() => runEquityHealthChecks(prisma, actorScope(context.actor), input)),
    ),
  };
}
