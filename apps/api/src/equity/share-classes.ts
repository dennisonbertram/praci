import { actorScope } from "@rakazo/contracts";
import {
  createEquityPlan,
  createEquityShareClass,
  getEquityPlan,
  getEquityShareClass,
  listEquityPlans,
  listEquityShareClasses,
  updateEquityPlan,
  updateEquityShareClass,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.shareClasses and equity.plans. */
export function shareClassRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    shareClasses: {
      list: authed.equity.shareClasses.list.handler(({ context, input }) =>
        equityCall(() => listEquityShareClasses(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.shareClasses.get.handler(({ context, input }) =>
        equityCall(() => getEquityShareClass(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.shareClasses.create.handler(({ context, input }) =>
        equityCall(() => createEquityShareClass(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.shareClasses.update.handler(({ context, input }) =>
        equityCall(() => updateEquityShareClass(prisma, actorScope(context.actor), input)),
      ),
    },
    plans: {
      list: authed.equity.plans.list.handler(({ context, input }) =>
        equityCall(() => listEquityPlans(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.plans.get.handler(({ context, input }) =>
        equityCall(() => getEquityPlan(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.plans.create.handler(({ context, input }) =>
        equityCall(() => createEquityPlan(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.plans.update.handler(({ context, input }) =>
        equityCall(() => updateEquityPlan(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
