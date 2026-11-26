import type { Actor } from "@rakazo/contracts";
import { runAsSystem, runAsTenant } from "@rakazo/db";
import type { Hono } from "hono";

/**
 * Routes with no signed-in Space to scope to. Account and session tables, signup bootstrap and
 * account deletion span tenants; webhooks and public links authenticate a bot, provider or token,
 * then resolve the tenant from it. Each runs in a named system scope.
 */
export const SYSTEM_ROUTES: ReadonlyArray<readonly [path: string, reason: string]> = [
  ["/api/auth/*", "authentication"],
  ["/api/v1/bots/*", "bot webhook"],
  ["/api/v1/messaging/*", "messaging webhook"],
  ["/api/v1/phone/*", "messaging webhook"],
  ["/api/v1/billing/*", "billing webhook"],
  ["/api/v1/mail/*", "mail push webhook"],
  ["/api/internal/screen-target", "screen proxy capability check"],
  ["/api/share/*", "public artifact share link"],
  ["/api/portal/*", "investor portal link"],
];

/** Routes a signed-in user calls outside RPC. They run as the caller's Space. */
export const TENANT_ROUTES: readonly string[] = [
  "/api/inbox/*",
  "/api/contacts/*",
  "/api/data-room/*",
  "/api/omi/*",
  "/api/meeting-captures/*",
  "/api/account/*",
  "/api/voice/*",
];

/** Register before any route of these paths: Hono runs middleware in registration order. */
export function mountSystemRoutes(app: Hono) {
  for (const [path, reason] of SYSTEM_ROUTES) {
    app.use(path, (_c, next) => runAsSystem(reason, next));
  }
}

/** Register before the routes it scopes, and after the session lookup it needs. */
export function mountTenantRoutes(
  app: Hono,
  sessionActor: (request: Request) => Promise<Actor | null>,
) {
  for (const path of TENANT_ROUTES) {
    app.use(path, async (c, next) => {
      const actor = await sessionActor(c.req.raw);
      return actor ? runAsTenant(actor, next) : next();
    });
  }
}
