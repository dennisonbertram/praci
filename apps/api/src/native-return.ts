import { Hono } from "hono";

export const NATIVE_CONNECTED_REDIRECT = "rakazo://integrations/connected";
export const NATIVE_RETURN_PATH = "/api/v1/connections/return";

/** The page Composio or Pipedream sends the browser to after sign-in. */
export function connectReturnUrl(
  origin: string,
  client: "ios" | undefined,
): string {
  return `${origin}${client === "ios" ? NATIVE_RETURN_PATH : "/integrations/connected"}`;
}

/**
 * Where Composio sends the iOS sign-in session. The in-app browser has no web session, so this
 * route needs none: it only closes the sheet. The app then finishes with `connections.complete`.
 * The target is fixed, so the query string is ignored and cannot steer the redirect.
 */
export function nativeReturnRoutes() {
  const app = new Hono();
  app.get(NATIVE_RETURN_PATH, (c) =>
    c.redirect(NATIVE_CONNECTED_REDIRECT, 302),
  );
  return app;
}
