import { actorScope } from "@rakazo/contracts";
import {
  createEquityRoundScenario,
  equityModelRound,
  getEquityRoundScenario,
  listEquityRoundScenarios,
  updateEquityRoundScenario,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.views.scenarios and modelRound: round modeling, never writes the ledger. */
export function scenarioRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    scenarios: {
      list: authed.equity.views.scenarios.list.handler(({ context, input }) =>
        equityCall(() => listEquityRoundScenarios(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.views.scenarios.get.handler(({ context, input }) =>
        equityCall(() => getEquityRoundScenario(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.views.scenarios.create.handler(({ context, input }) =>
        equityCall(() => createEquityRoundScenario(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.views.scenarios.update.handler(({ context, input }) =>
        equityCall(() => updateEquityRoundScenario(prisma, actorScope(context.actor), input)),
      ),
    },
    modelRound: authed.equity.views.modelRound.handler(({ context, input }) =>
      equityCall(() => equityModelRound(prisma, actorScope(context.actor), input)),
    ),
  };
}
