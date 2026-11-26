import type { RouteContext } from "../routes/context.js";
import { byStakeholderRoutes } from "./views-by-stakeholder.js";
import { financingRoutes } from "./views-financing.js";
import { healthRoutes } from "./views-health.js";
import { reportRoutes } from "./views-reports.js";
import { scenarioRoutes } from "./views-scenarios.js";
import { estimatedValueRoutes } from "./views-value.js";

/** equity.views: one routes file per feature. */
export function viewRoutes(context: RouteContext) {
  return {
    views: {
      ...byStakeholderRoutes(context),
      ...financingRoutes(context),
      ...scenarioRoutes(context),
      ...reportRoutes(context),
      ...healthRoutes(context),
      ...estimatedValueRoutes(context),
    },
  };
}
