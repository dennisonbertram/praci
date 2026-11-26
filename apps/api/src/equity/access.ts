import { actorScope } from "@rakazo/contracts";
import {
  createEquityHealthFinding,
  createEquitySavedView,
  getEquityHealthFinding,
  getEquitySavedView,
  listEquityAccessGrants,
  listEquityAccessGroups,
  listEquityHealthFindings,
  listEquitySavedViews,
  setEquityAccessGrant,
  setEquityAccessGroup,
  updateEquityHealthFinding,
  updateEquitySavedView,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.savedViews, equity.accessGroups, equity.accessGrants and equity.healthFindings. */
export function accessRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    savedViews: {
      list: authed.equity.savedViews.list.handler(({ context, input }) =>
        equityCall(() => listEquitySavedViews(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.savedViews.get.handler(({ context, input }) =>
        equityCall(() => getEquitySavedView(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.savedViews.create.handler(({ context, input }) =>
        equityCall(() => createEquitySavedView(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.savedViews.update.handler(({ context, input }) =>
        equityCall(() => updateEquitySavedView(prisma, actorScope(context.actor), input)),
      ),
    },
    accessGroups: {
      list: authed.equity.accessGroups.list.handler(({ context }) =>
        equityCall(() => listEquityAccessGroups(prisma, actorScope(context.actor))),
      ),
      set: authed.equity.accessGroups.set.handler(({ context, input }) =>
        equityCall(() => setEquityAccessGroup(prisma, actorScope(context.actor), input)),
      ),
    },
    accessGrants: {
      list: authed.equity.accessGrants.list.handler(({ context, input }) =>
        equityCall(() => listEquityAccessGrants(prisma, actorScope(context.actor), input)),
      ),
      set: authed.equity.accessGrants.set.handler(({ context, input }) =>
        equityCall(() => setEquityAccessGrant(prisma, actorScope(context.actor), input)),
      ),
    },
    healthFindings: {
      list: authed.equity.healthFindings.list.handler(({ context, input }) =>
        equityCall(() => listEquityHealthFindings(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.healthFindings.get.handler(({ context, input }) =>
        equityCall(() => getEquityHealthFinding(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.healthFindings.create.handler(({ context, input }) =>
        equityCall(() => createEquityHealthFinding(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.healthFindings.update.handler(({ context, input }) =>
        equityCall(() => updateEquityHealthFinding(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
