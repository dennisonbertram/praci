import { ORPCError } from "@orpc/server";
import type { BillingService } from "../billing.js";
import type { RouteContext, RouterDeps } from "./context.js";

export function createBillingRoutes({ deps, authed }: RouteContext) {
  return {
    status: authed.billing.status.handler(async ({ context }) =>
      requireBilling(deps).status(context.actor),
    ),
    checkout: authed.billing.checkout.handler(async ({ context }) =>
      requireBilling(deps).checkout(context.actor),
    ),
    portal: authed.billing.portal.handler(async ({ context }) =>
      requireBilling(deps).portal(context.actor),
    ),
  };
}

function requireBilling(deps: RouterDeps): BillingService {
  if (!deps.billing) throw new ORPCError("NOT_FOUND", { message: "Billing is not enabled" });
  return deps.billing;
}
