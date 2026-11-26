import { actorScope } from "@rakazo/contracts";
import {
  cancelEquityOptionGrant,
  cancelEquityWarrant,
  cancelPendingEquityExercises,
  completeEquityExercise,
  createEquityWarrant,
  exerciseEquityOptions,
  expireEquityOptionGrants,
  getEquityPlanPool,
  increaseEquityPlanPool,
  issueEquityOptionDraftSet,
  listEquityPlanPools,
  listEquityWarrants,
  pourOverEquityPlan,
  previewEquityTermination,
  reverseEquityOptionCancellation,
  reverseEquityTermination,
  setEquityPostTerminationPeriod,
  terminateEquityStakeholder,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.optionActions, equity.planPools and equity.warrants. */
export function optionAreaRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  const { optionActions, planPools, warrants } = authed.equity;
  return {
    optionActions: {
      cancel: optionActions.cancel.handler(({ context, input }) =>
        equityCall(() => cancelEquityOptionGrant(prisma, actorScope(context.actor), input)),
      ),
      reverseCancellation: optionActions.reverseCancellation.handler(({ context, input }) =>
        equityCall(() => reverseEquityOptionCancellation(prisma, actorScope(context.actor), input)),
      ),
      cancelPendingExercises: optionActions.cancelPendingExercises.handler(({ context, input }) =>
        equityCall(() => cancelPendingEquityExercises(prisma, actorScope(context.actor), input)),
      ),
      exercise: optionActions.exercise.handler(({ context, input }) =>
        equityCall(() => exerciseEquityOptions(prisma, actorScope(context.actor), input)),
      ),
      terminate: optionActions.terminate.handler(({ context, input }) =>
        equityCall(() => terminateEquityStakeholder(prisma, actorScope(context.actor), input)),
      ),
      previewTermination: optionActions.previewTermination.handler(({ context, input }) =>
        equityCall(() => previewEquityTermination(prisma, actorScope(context.actor), input)),
      ),
      reverseTermination: optionActions.reverseTermination.handler(({ context, input }) =>
        equityCall(() => reverseEquityTermination(prisma, actorScope(context.actor), input)),
      ),
      setPostTerminationPeriod: optionActions.setPostTerminationPeriod.handler(
        ({ context, input }) =>
          equityCall(() =>
            setEquityPostTerminationPeriod(prisma, actorScope(context.actor), input),
          ),
      ),
      expire: optionActions.expire.handler(({ context, input }) =>
        equityCall(() => expireEquityOptionGrants(prisma, actorScope(context.actor), input)),
      ),
      completeExercise: optionActions.completeExercise.handler(({ context, input }) =>
        equityCall(() => completeEquityExercise(prisma, actorScope(context.actor), input)),
      ),
      issueDraftSet: optionActions.issueDraftSet.handler(({ context, input }) =>
        equityCall(() => issueEquityOptionDraftSet(prisma, actorScope(context.actor), input)),
      ),
    },
    planPools: {
      list: planPools.list.handler(({ context }) =>
        equityCall(() => listEquityPlanPools(prisma, actorScope(context.actor))),
      ),
      get: planPools.get.handler(({ context, input }) =>
        equityCall(() => getEquityPlanPool(prisma, actorScope(context.actor), input)),
      ),
      increase: planPools.increase.handler(({ context, input }) =>
        equityCall(() => increaseEquityPlanPool(prisma, actorScope(context.actor), input)),
      ),
      pourOver: planPools.pourOver.handler(({ context, input }) =>
        equityCall(() => pourOverEquityPlan(prisma, actorScope(context.actor), input)),
      ),
    },
    warrants: {
      list: warrants.list.handler(({ context, input }) =>
        equityCall(() => listEquityWarrants(prisma, actorScope(context.actor), input)),
      ),
      create: warrants.create.handler(({ context, input }) =>
        equityCall(() => createEquityWarrant(prisma, actorScope(context.actor), input)),
      ),
      cancel: warrants.cancel.handler(({ context, input }) =>
        equityCall(() => cancelEquityWarrant(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
