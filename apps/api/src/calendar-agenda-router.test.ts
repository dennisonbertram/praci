import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};

describe("calendar.agenda", () => {
  it("returns googleConnected false when there are no calendar accounts", async () => {
    const prisma = {
      connection: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const deps = {
      prisma,
      env: {
        defaultProvider: "fake",
        defaultModel: "fake-model",
        webOrigin: "http://127.0.0.1:5173",
        screenProxySecret: "fake-test-secret",
        sandboxProvider: "fake",
      },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps;
    const client = createRouterClient(createRouter(deps), { context: { actor } });

    await expect(
      client.calendar.agenda({
        from: "2026-11-10T00:00:00.000Z",
        to: "2026-11-11T00:00:00.000Z",
        sources: "google",
      }),
    ).resolves.toMatchObject({ googleConnected: false });
  });

  it("rejects when the calendar account lookup fails", async () => {
    const lookupError = new Error("database unavailable");
    const prisma = {
      connection: { findMany: vi.fn().mockRejectedValue(lookupError) },
    } as unknown as PrismaClient;
    const deps = {
      prisma,
      env: {
        defaultProvider: "fake",
        defaultModel: "fake-model",
        webOrigin: "http://127.0.0.1:5173",
        screenProxySecret: "fake-test-secret",
        sandboxProvider: "fake",
      },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps;
    const client = createRouterClient(createRouter(deps), { context: { actor } });

    await expect(
      client.calendar.agenda({
        from: "2026-11-10T00:00:00.000Z",
        to: "2026-11-11T00:00:00.000Z",
        sources: "google",
      }),
    ).rejects.toThrow("database unavailable");
  });

  it('rejects when the calendar account lookup fails with sources "local"', async () => {
    const lookupError = new Error("database unavailable");
    const prisma = {
      connection: { findMany: vi.fn().mockRejectedValue(lookupError) },
    } as unknown as PrismaClient;
    const deps = {
      prisma,
      env: {
        defaultProvider: "fake",
        defaultModel: "fake-model",
        webOrigin: "http://127.0.0.1:5173",
        screenProxySecret: "fake-test-secret",
        sandboxProvider: "fake",
      },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps;
    const client = createRouterClient(createRouter(deps), { context: { actor } });

    await expect(
      client.calendar.agenda({
        from: "2026-11-10T00:00:00.000Z",
        to: "2026-11-11T00:00:00.000Z",
        sources: "local",
      }),
    ).rejects.toThrow("database unavailable");
  });
});
