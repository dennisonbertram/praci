import { actorScope } from "@rakazo/contracts";
import { equityReport, equityReportHistory } from "@rakazo/db";
import type { RouteContext } from "../routes/context.js";
import { equityCall } from "./errors.js";

/** equity.views.report. */
export function reportRoutes({ deps, authed }: RouteContext) {
  const { prisma } = deps;
  return {
    report: authed.equity.views.report.handler(({ context, input }) =>
      equityCall(() => equityReport(prisma, actorScope(context.actor), input)),
    ),
    reportHistory: authed.equity.views.reportHistory.handler(({ context }) =>
      equityCall(() => equityReportHistory(prisma, actorScope(context.actor))),
    ),
  };
}
