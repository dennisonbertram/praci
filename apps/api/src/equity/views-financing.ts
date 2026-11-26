import { actorScope } from "@rakazo/contracts";
import { attachEquityToRound, equityCashRaised } from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.views.cashRaised and attachToRound. */
export function financingRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    cashRaised: authed.equity.views.cashRaised.handler(({ context, input }) =>
      equityCall(() => equityCashRaised(prisma, actorScope(context.actor), input)),
    ),
    attachToRound: authed.equity.views.attachToRound.handler(({ context, input }) =>
      equityCall(() => attachEquityToRound(prisma, actorScope(context.actor), input)),
    ),
  };
}
