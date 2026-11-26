import { readdirSync, readFileSync } from "node:fs";
import type { Actor } from "@rakazo/contracts";
import { currentDbContext } from "@rakazo/db";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  mountSystemRoutes,
  mountTenantRoutes,
  SYSTEM_ROUTES,
  TENANT_ROUTES,
} from "./route-scope.js";

const actor = { userId: "u1", spaceId: "s1" } as Actor;

function probe(signedIn: boolean) {
  const app = new Hono();
  mountSystemRoutes(app);
  mountTenantRoutes(app, async () => (signedIn ? actor : null));
  for (const [path] of SYSTEM_ROUTES)
    app.get(path.replace("*", "x"), (c) => c.json(currentDbContext() ?? null));
  for (const path of TENANT_ROUTES)
    app.get(path.replace("*", "x"), (c) => c.json(currentDbContext() ?? null));
  return app;
}

describe("route database scopes", () => {
  it("runs public and provider routes in a named system scope", async () => {
    const app = probe(false);
    for (const [path, reason] of SYSTEM_ROUTES) {
      const response = await app.request(path.replace("*", "x"));
      expect(await response.json(), path).toEqual({ kind: "system", reason });
    }
  });

  it("runs a signed-in user's routes as their Space, and gives no scope without a session", async () => {
    for (const path of TENANT_ROUTES) {
      const url = path.replace("*", "x");
      expect(await (await probe(true).request(url)).json(), path).toEqual({
        kind: "tenant",
        spaceId: "s1",
        userId: "u1",
      });
      expect(await (await probe(false).request(url)).json(), path).toBeNull();
    }
  });

  it("covers every HTTP route the API mounts outside RPC", () => {
    const covered = [...SYSTEM_ROUTES.map(([path]) => path), ...TENANT_ROUTES].map((path) =>
      path.replace(/\*$/, ""),
    );
    // Routes that never read the database, or that carry their own scope.
    const exempt = ["/api/dev/emails", "/api/inbox/image"];
    const routes = new Set<string>();
    for (const file of readdirSync(new URL(".", import.meta.url))) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      for (const match of source.matchAll(
        /\bapp\.(?:get|post|put|patch|delete|all|on)\(\s*(?:\[[^\]]*\],\s*)?["`](\/api\/[^"`]*)["`]/g,
      )) {
        routes.add(match[1]!.replace(/\$\{PATH\}/g, ""));
      }
    }
    expect(routes.size).toBeGreaterThan(8);
    for (const route of routes) {
      if (exempt.includes(route)) continue;
      expect(
        covered.some((prefix) => route.startsWith(prefix)),
        `${route} needs a database scope in route-scope.ts`,
      ).toBe(true);
    }
  });
});
