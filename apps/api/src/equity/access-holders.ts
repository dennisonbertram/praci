import { actorScope } from "@rakazo/contracts";
import {
  linkEquityHolderContact,
  listEquityAccessHolders,
  resolveEquityAccessRequest,
  setEquityAccessLevels,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.accessHolders: the investor relations list, bulk access changes and requests. */
export function accessHolderRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    accessHolders: {
      list: authed.equity.accessHolders.list.handler(({ context, input }) =>
        equityCall(() => listEquityAccessHolders(prisma, actorScope(context.actor), input)),
      ),
      setLevels: authed.equity.accessHolders.setLevels.handler(({ context, input }) =>
        equityCall(() => setEquityAccessLevels(prisma, actorScope(context.actor), input)),
      ),
      resolveRequest: authed.equity.accessHolders.resolveRequest.handler(({ context, input }) =>
        equityCall(() => resolveEquityAccessRequest(prisma, actorScope(context.actor), input)),
      ),
      linkContact: authed.equity.accessHolders.linkContact.handler(({ context, input }) =>
        equityCall(() => linkEquityHolderContact(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
