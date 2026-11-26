import { RPCHandler } from "@orpc/server/fetch";
import type * as Adapters from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const lifecycle = vi.hoisted(() => ({
  provisionComputer: vi.fn(),
  releaseComputerExecutionLease: vi.fn(),
  acquireComputerExecutionLease: vi.fn(),
}));

vi.mock("@rakazo/adapters", async (original) => ({
  ...(await original<typeof Adapters>()),
  acquireComputerExecutionLease: lifecycle.acquireComputerExecutionLease,
  provisionComputer: lifecycle.provisionComputer,
  releaseComputerExecutionLease: lifecycle.releaseComputerExecutionLease,
}));

lifecycle.acquireComputerExecutionLease.mockResolvedValue(null);

describe("computer boot", () => {
  it("reports a computer removed while the boot waited as not found", async () => {
    lifecycle.provisionComputer.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("No record was found for a query.", {
        code: "P2025",
        clientVersion: "test",
      }),
    );
    const prisma = {
      bot: {
        findFirst: vi.fn().mockResolvedValue({
          id: "bot-1",
          thread: { id: "thread-1" },
          computer: { id: "computer-1", state: "booting", providerRef: null, scope: "team" },
        }),
      },
    } as unknown as PrismaClient;
    const deps = {
      prisma,
      jobs: { enqueue: vi.fn() },
      env: {
        defaultProvider: "fake",
        defaultModel: "fake-model",
        webOrigin: "https://web.example.test",
        screenProxySecret: "fake-test-secret",
        sandboxProvider: "fake",
      },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps;
    const actor = {
      spaceId: "workspace-1",
      userId: "user-1",
      email: "user@example.test",
      isDeploymentOwner: true,
    } satisfies Actor;
    const handler = new RPCHandler(createRouter(deps));

    const { response } = await handler.handle(
      new Request("https://api.example.test/rpc/computer/boot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { botId: "bot-1" } }),
      }),
      { prefix: "/rpc", context: { actor } },
    );

    expect(response?.status).toBe(404);
    expect(lifecycle.provisionComputer).toHaveBeenCalledOnce();
    expect(lifecycle.releaseComputerExecutionLease).toHaveBeenCalledOnce();
  });

  describe("a computer that is going to sleep", () => {
    const actor = {
      spaceId: "workspace-1",
      userId: "user-1",
      email: "user@example.test",
      isDeploymentOwner: true,
    } satisfies Actor;

    function boot(reads: (computer: Record<string, unknown>) => ReturnType<typeof vi.fn>) {
      const base = {
        id: "computer-1",
        scope: "team",
        providerRef: "ref-1",
        maintenanceId: null,
        controlHolder: "none",
        updatedAt: new Date(),
      };
      const bot = {
        id: "bot-1",
        name: "Ada",
        thread: { id: "thread-1" },
        computer: { ...base, state: "suspending" },
      };
      const prisma = {
        bot: { findFirst: vi.fn().mockResolvedValue(bot) },
        computer: { findUniqueOrThrow: reads(base) },
        computerExecutionLease: {
          updateManyAndReturn: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ fence: 1 }),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;
      const deps = {
        prisma,
        jobs: { enqueue: vi.fn() },
        env: { sandboxProvider: "fake" },
      } as unknown as RouterDeps;
      const handler = new RPCHandler(createRouter(deps));
      return handler.handle(
        new Request("https://api.example.test/rpc/computer/boot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ json: { botId: "bot-1" } }),
        }),
        { prefix: "/rpc", context: { actor } },
      );
    }

    async function useRealLease() {
      const actual = await vi.importActual<typeof Adapters>("@rakazo/adapters");
      lifecycle.acquireComputerExecutionLease.mockImplementationOnce(
        actual.acquireComputerExecutionLease,
      );
    }

    it("waits for it to finish suspending, then boots", async () => {
      vi.useFakeTimers();
      try {
        lifecycle.provisionComputer.mockReset().mockResolvedValue(undefined);
        await useRealLease();
        const pending = boot((base) =>
          vi
            .fn()
            .mockResolvedValueOnce({ ...base, state: "suspending" })
            .mockResolvedValue({ ...base, state: "suspended" }),
        );
        await vi.advanceTimersByTimeAsync(1_000);
        const { response } = await pending;
        expect(response?.status).toBe(200);
        expect(lifecycle.provisionComputer).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it("stays busy when it is still suspending after the wait", async () => {
      vi.useFakeTimers();
      try {
        lifecycle.provisionComputer.mockReset().mockResolvedValue(undefined);
        await useRealLease();
        const pending = boot((base) =>
          vi.fn().mockImplementation(async () => ({
            ...base,
            state: "suspending",
            updatedAt: new Date(),
          })),
        );
        await vi.advanceTimersByTimeAsync(15_000);
        const { response } = await pending;
        expect(response?.status).toBe(409);
        expect(lifecycle.provisionComputer).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
