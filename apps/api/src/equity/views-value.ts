import { actorScope } from "@rakazo/contracts";
import { getEquityEstimatedValue, setEquityEstimatedValue } from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.views.estimatedValue. */
export function estimatedValueRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    estimatedValue: {
      get: authed.equity.views.estimatedValue.get.handler(({ context }) =>
        equityCall(() => getEquityEstimatedValue(prisma, actorScope(context.actor))),
      ),
      set: authed.equity.views.estimatedValue.set.handler(({ context, input }) =>
        equityCall(() => setEquityEstimatedValue(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
