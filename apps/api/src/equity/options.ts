import { actorScope } from "@rakazo/contracts";
import {
  createEquityExercise,
  createEquityOptionGrant,
  createEquityVestingTemplate,
  getEquityExercise,
  getEquityOptionGrant,
  getEquityVestingTemplate,
  listEquityExercises,
  listEquityOptionGrants,
  listEquityVestingTemplates,
  updateEquityExercise,
  updateEquityOptionGrant,
  updateEquityVestingTemplate,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.optionGrants, equity.vestingTemplates and equity.exercises. */
export function optionRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    optionGrants: {
      list: authed.equity.optionGrants.list.handler(({ context, input }) =>
        equityCall(() => listEquityOptionGrants(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.optionGrants.get.handler(({ context, input }) =>
        equityCall(() => getEquityOptionGrant(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.optionGrants.create.handler(({ context, input }) =>
        equityCall(() => createEquityOptionGrant(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.optionGrants.update.handler(({ context, input }) =>
        equityCall(() => updateEquityOptionGrant(prisma, actorScope(context.actor), input)),
      ),
    },
    vestingTemplates: {
      list: authed.equity.vestingTemplates.list.handler(({ context, input }) =>
        equityCall(() => listEquityVestingTemplates(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.vestingTemplates.get.handler(({ context, input }) =>
        equityCall(() => getEquityVestingTemplate(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.vestingTemplates.create.handler(({ context, input }) =>
        equityCall(() => createEquityVestingTemplate(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.vestingTemplates.update.handler(({ context, input }) =>
        equityCall(() => updateEquityVestingTemplate(prisma, actorScope(context.actor), input)),
      ),
    },
    exercises: {
      list: authed.equity.exercises.list.handler(({ context, input }) =>
        equityCall(() => listEquityExercises(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.exercises.get.handler(({ context, input }) =>
        equityCall(() => getEquityExercise(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.exercises.create.handler(({ context, input }) =>
        equityCall(() => createEquityExercise(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.exercises.update.handler(({ context, input }) =>
        equityCall(() => updateEquityExercise(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
