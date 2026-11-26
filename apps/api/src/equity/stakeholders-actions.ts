import { actorScope } from "@rakazo/contracts";
import {
  bulkCreateEquityStakeholders,
  bulkUpdateEquityStakeholders,
  countEquityStakeholderChanges,
  deleteEquityCustomProperty,
  getEquityHrisPreferences,
  importEquityStakeholderChanges,
  listEquityStakeholderChanges,
  mergeEquityStakeholders,
  resolveEquityStakeholderChange,
  setEquityHrisPreferences,
  terminateEquityStakeholders,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.stakeholderActions, equity.stakeholderChanges and equity.hrisPreferences. */
export function stakeholderAreaRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  const { stakeholderActions, stakeholderChanges, hrisPreferences } = authed.equity;
  return {
    stakeholderActions: {
      bulkCreate: stakeholderActions.bulkCreate.handler(({ context, input }) =>
        equityCall(() => bulkCreateEquityStakeholders(prisma, actorScope(context.actor), input)),
      ),
      bulkUpdate: stakeholderActions.bulkUpdate.handler(({ context, input }) =>
        equityCall(() => bulkUpdateEquityStakeholders(prisma, actorScope(context.actor), input)),
      ),
      merge: stakeholderActions.merge.handler(({ context, input }) =>
        equityCall(() => mergeEquityStakeholders(prisma, actorScope(context.actor), input)),
      ),
      deleteCustomProperty: stakeholderActions.deleteCustomProperty.handler(({ context, input }) =>
        equityCall(() => deleteEquityCustomProperty(prisma, actorScope(context.actor), input)),
      ),
      terminate: stakeholderActions.terminate.handler(({ context, input }) =>
        equityCall(() => terminateEquityStakeholders(prisma, actorScope(context.actor), input)),
      ),
    },
    stakeholderChanges: {
      list: stakeholderChanges.list.handler(({ context, input }) =>
        equityCall(() => listEquityStakeholderChanges(prisma, actorScope(context.actor), input)),
      ),
      counts: stakeholderChanges.counts.handler(({ context }) =>
        equityCall(() => countEquityStakeholderChanges(prisma, actorScope(context.actor))),
      ),
      import: stakeholderChanges.import.handler(({ context, input }) =>
        equityCall(() => importEquityStakeholderChanges(prisma, actorScope(context.actor), input)),
      ),
      resolve: stakeholderChanges.resolve.handler(({ context, input }) =>
        equityCall(() => resolveEquityStakeholderChange(prisma, actorScope(context.actor), input)),
      ),
    },
    hrisPreferences: {
      get: hrisPreferences.get.handler(({ context }) =>
        equityCall(() => getEquityHrisPreferences(prisma, actorScope(context.actor))),
      ),
      set: hrisPreferences.set.handler(({ context, input }) =>
        equityCall(() => setEquityHrisPreferences(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
