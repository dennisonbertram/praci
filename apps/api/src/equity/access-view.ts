import { actorScope } from "@rakazo/contracts";
import { equityAccessView } from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.accessView: the admin preview of what one holder sees at an access level. */
export function accessViewRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    accessView: {
      get: authed.equity.accessView.get.handler(({ context, input }) =>
        equityCall(() => equityAccessView(prisma, actorScope(context.actor), input)),
      ),
    },
  };
}
