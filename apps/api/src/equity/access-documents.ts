import { actorScope } from "@rakazo/contracts";
import {
  createEquityDocumentLink,
  deleteEquityDocumentLink,
  listEquityDocumentLinks,
} from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.documentLinks: Data room documents attached to stakeholders, certificates and rounds. */
export function documentLinkRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    documentLinks: {
      list: authed.equity.documentLinks.list.handler(({ context, input }) =>
        equityCall(() => listEquityDocumentLinks(prisma, actorScope(context.actor), input)),
      ),
      create: authed.equity.documentLinks.create.handler(({ context, input }) =>
        equityCall(() => createEquityDocumentLink(prisma, actorScope(context.actor), input)),
      ),
      delete: authed.equity.documentLinks.delete.handler(({ context, input }) =>
        equityCall(() => deleteEquityDocumentLink(prisma, actorScope(context.actor), input.id)),
      ),
    },
  };
}
