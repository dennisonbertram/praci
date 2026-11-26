import { actorScope } from "@rakazo/contracts";
import {
  createEquityCustomProperty,
  createEquityStakeholder,
  getEquityStakeholder,
  listEquityCustomProperties,
  listEquityStakeholders,
  updateEquityCustomProperty,
  updateEquityStakeholder,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.stakeholders and equity.customProperties. */
export function stakeholderRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    stakeholders: {
      list: authed.equity.stakeholders.list.handler(({ context, input }) =>
        equityCall(() => listEquityStakeholders(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.stakeholders.get.handler(({ context, input }) =>
        equityCall(() => getEquityStakeholder(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.stakeholders.create.handler(({ context, input }) =>
        equityCall(() => createEquityStakeholder(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.stakeholders.update.handler(({ context, input }) =>
        equityCall(() => updateEquityStakeholder(prisma, actorScope(context.actor), input)),
      ),
    },
    customProperties: {
      list: authed.equity.customProperties.list.handler(({ context }) =>
        equityCall(() => listEquityCustomProperties(prisma, actorScope(context.actor))),
      ),
      create: authed.equity.customProperties.create.handler(({ context, input }) =>
        equityCall(() => createEquityCustomProperty(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.customProperties.update.handler(({ context, input }) =>
        equityCall(() => updateEquityCustomProperty(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
