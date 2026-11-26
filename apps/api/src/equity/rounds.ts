import { actorScope } from "@rakazo/contracts";
import {
  createEquityDraftSet,
  createEquityFundingRound,
  getEquityDraftSet,
  getEquityFundingRound,
  listEquityDraftSets,
  listEquityFundingRounds,
  updateEquityDraftSet,
  updateEquityFundingRound,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.fundingRounds and equity.draftSets. */
export function roundRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    fundingRounds: {
      list: authed.equity.fundingRounds.list.handler(({ context, input }) =>
        equityCall(() => listEquityFundingRounds(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.fundingRounds.get.handler(({ context, input }) =>
        equityCall(() => getEquityFundingRound(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.fundingRounds.create.handler(({ context, input }) =>
        equityCall(() => createEquityFundingRound(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.fundingRounds.update.handler(({ context, input }) =>
        equityCall(() => updateEquityFundingRound(prisma, actorScope(context.actor), input)),
      ),
    },
    draftSets: {
      list: authed.equity.draftSets.list.handler(({ context, input }) =>
        equityCall(() => listEquityDraftSets(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.draftSets.get.handler(({ context, input }) =>
        equityCall(() => getEquityDraftSet(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.draftSets.create.handler(({ context, input }) =>
        equityCall(() => createEquityDraftSet(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.draftSets.update.handler(({ context, input }) =>
        equityCall(() => updateEquityDraftSet(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
