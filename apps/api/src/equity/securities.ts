import { actorScope } from "@rakazo/contracts";
import {
  createEquityCertificate,
  createEquityConvertible,
  createEquityConvertibleBlock,
  getEquityCertificate,
  getEquityConvertible,
  getEquityTransaction,
  listEquityCertificates,
  listEquityConvertibleBlocks,
  listEquityConvertibles,
  listEquityTransactions,
  updateEquityCertificate,
  updateEquityConvertible,
  updateEquityConvertibleBlock,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.certificates, equity.convertibleBlocks, equity.convertibles and equity.transactions. */
export function securityRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    certificates: {
      list: authed.equity.certificates.list.handler(({ context, input }) =>
        equityCall(() => listEquityCertificates(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.certificates.get.handler(({ context, input }) =>
        equityCall(() => getEquityCertificate(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.certificates.create.handler(({ context, input }) =>
        equityCall(() => createEquityCertificate(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.certificates.update.handler(({ context, input }) =>
        equityCall(() => updateEquityCertificate(prisma, actorScope(context.actor), input)),
      ),
    },
    convertibleBlocks: {
      list: authed.equity.convertibleBlocks.list.handler(({ context }) =>
        equityCall(() => listEquityConvertibleBlocks(prisma, actorScope(context.actor))),
      ),
      create: authed.equity.convertibleBlocks.create.handler(({ context, input }) =>
        equityCall(() => createEquityConvertibleBlock(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.convertibleBlocks.update.handler(({ context, input }) =>
        equityCall(() => updateEquityConvertibleBlock(prisma, actorScope(context.actor), input)),
      ),
    },
    convertibles: {
      list: authed.equity.convertibles.list.handler(({ context, input }) =>
        equityCall(() => listEquityConvertibles(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.convertibles.get.handler(({ context, input }) =>
        equityCall(() => getEquityConvertible(prisma, actorScope(context.actor), input.id)),
      ),
      create: authed.equity.convertibles.create.handler(({ context, input }) =>
        equityCall(() => createEquityConvertible(prisma, actorScope(context.actor), input)),
      ),
      update: authed.equity.convertibles.update.handler(({ context, input }) =>
        equityCall(() => updateEquityConvertible(prisma, actorScope(context.actor), input)),
      ),
    },
    transactions: {
      list: authed.equity.transactions.list.handler(({ context, input }) =>
        equityCall(() => listEquityTransactions(prisma, actorScope(context.actor), input)),
      ),
      get: authed.equity.transactions.get.handler(({ context, input }) =>
        equityCall(() => getEquityTransaction(prisma, actorScope(context.actor), input.id)),
      ),
    },
  };
}
