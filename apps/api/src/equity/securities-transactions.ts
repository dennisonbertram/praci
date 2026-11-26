import { actorScope } from "@rakazo/contracts";
import {
  addEquityAppSafeToLedger,
  cancelEquityCertificate,
  cancelEquityConvertible,
  convertEquityCertificate,
  convertEquityPricedRound,
  equityCertificateTotals,
  equityConvertibleTotals,
  getEquitySafeFunding,
  issueEquityDraftSet,
  listEquityAppSafes,
  previewEquityPricedRound,
  repurchaseEquityCertificate,
  reviewEquityDraftSet,
  setEquitySafeFunding,
  transferEquityCertificate,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.shareTransactions (certificates) and equity.convertibleTransactions (SAFEs and notes). */
export function shareTransactionRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  const routes = authed.equity.shareTransactions;
  const convertibles = authed.equity.convertibleTransactions;
  const drafts = authed.equity.draftSetActions;
  return {
    safeFunding: {
      get: authed.equity.safeFunding.get.handler(({ context }) =>
        equityCall(() => getEquitySafeFunding(prisma, actorScope(context.actor))),
      ),
      set: authed.equity.safeFunding.set.handler(({ context, input }) =>
        equityCall(() => setEquitySafeFunding(prisma, actorScope(context.actor), input)),
      ),
    },
    convertibleTotals: authed.equity.convertibleTotals.handler(({ context, input }) =>
      equityCall(() => equityConvertibleTotals(prisma, actorScope(context.actor), input)),
    ),
    certificateTotals: authed.equity.certificateTotals.handler(({ context, input }) =>
      equityCall(() => equityCertificateTotals(prisma, actorScope(context.actor), input)),
    ),
    appSafes: {
      list: authed.equity.appSafes.list.handler(({ context, input }) =>
        equityCall(() => listEquityAppSafes(prisma, actorScope(context.actor), input)),
      ),
      addToLedger: authed.equity.appSafes.addToLedger.handler(({ context, input }) =>
        equityCall(() => addEquityAppSafeToLedger(prisma, actorScope(context.actor), input)),
      ),
    },
    draftSetActions: {
      review: drafts.review.handler(({ context, input }) =>
        equityCall(() => reviewEquityDraftSet(prisma, actorScope(context.actor), input)),
      ),
      issue: drafts.issue.handler(({ context, input }) =>
        equityCall(() => issueEquityDraftSet(prisma, actorScope(context.actor), input)),
      ),
    },
    convertibleTransactions: {
      cancel: convertibles.cancel.handler(({ context, input }) =>
        equityCall(() => cancelEquityConvertible(prisma, actorScope(context.actor), input)),
      ),
      previewPricedRound: convertibles.previewPricedRound.handler(({ context, input }) =>
        equityCall(() => previewEquityPricedRound(prisma, actorScope(context.actor), input)),
      ),
      convertPricedRound: convertibles.convertPricedRound.handler(({ context, input }) =>
        equityCall(() => convertEquityPricedRound(prisma, actorScope(context.actor), input)),
      ),
    },
    shareTransactions: {
      transfer: routes.transfer.handler(({ context, input }) =>
        equityCall(() => transferEquityCertificate(prisma, actorScope(context.actor), input)),
      ),
      repurchase: routes.repurchase.handler(({ context, input }) =>
        equityCall(() => repurchaseEquityCertificate(prisma, actorScope(context.actor), input)),
      ),
      cancel: routes.cancel.handler(({ context, input }) =>
        equityCall(() => cancelEquityCertificate(prisma, actorScope(context.actor), input)),
      ),
      convert: routes.convert.handler(({ context, input }) =>
        equityCall(() => convertEquityCertificate(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
