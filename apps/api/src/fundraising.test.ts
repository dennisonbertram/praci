import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

const { syncSafesForUser, listSafes, getFundraisingOverview, warn } = vi.hoisted(() => ({
  syncSafesForUser: vi.fn(),
  listSafes: vi.fn(async () => [{ id: "safe-1" }]),
  getFundraisingOverview: vi.fn(async () => ({ investors: [] })),
  warn: vi.fn(),
}));
vi.mock("@rakazo/adapters", () => ({ syncSafesForUser }));
vi.mock("@rakazo/db", async (original) => ({
  ...(await original<object>()),
  listSafes,
  getFundraisingOverview,
}));
vi.mock("@rakazo/logging", () => ({ getLogger: () => ({ warn }) }));

const { safesList, fundraisingOverview, fundraisingRefresh } = await import("./fundraising.js");

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};
const deps = {
  prisma: {} as never,
  mcpOAuth: { statusFor: vi.fn() },
  safeCallToolFor: vi.fn() as never,
};

describe("safesList", () => {
  it("runs the throttled, not forced, Mercury sync before reading the rows", async () => {
    syncSafesForUser.mockResolvedValue("synced");
    expect(await safesList(deps, actor)).toEqual([{ id: "safe-1" }]);
    expect(syncSafesForUser).toHaveBeenCalledTimes(1);
    expect(syncSafesForUser.mock.calls[0]?.[2]).toMatchObject({ force: false });
  });

  it("still returns the stored rows when Mercury fails", async () => {
    syncSafesForUser.mockRejectedValue(new Error("mercury down"));
    expect(await safesList(deps, actor)).toEqual([{ id: "safe-1" }]);
  });

  it("logs only the error name when the sync fails, never the message", async () => {
    warn.mockClear();
    const error = new Error("Invalid query: email = 'secret@example.test'");
    error.name = "PrismaClientKnownRequestError";
    syncSafesForUser.mockRejectedValue(error);
    expect(await safesList(deps, actor)).toEqual([{ id: "safe-1" }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("fundraising page sync failed", {
      errorName: "PrismaClientKnownRequestError",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret@example.test");
  });
});

const mercuryServer = { endpoint: "https://mcp.mercury.com/mcp" };

function overviewDeps(opts: { servers?: unknown[]; state?: unknown; login?: string }) {
  return {
    prisma: {
      mcpServer: { findMany: vi.fn(async () => opts.servers ?? [mercuryServer]) },
      safeSyncState: { findUnique: vi.fn(async () => opts.state ?? null) },
    } as never,
    mcpOAuth: { statusFor: vi.fn(async () => opts.login ?? "ok") },
  };
}

describe("fundraisingOverview mercury state", () => {
  const status = async (opts: Parameters<typeof overviewDeps>[0]) =>
    (await fundraisingOverview(overviewDeps(opts), actor)).mercury.status;

  it("is not_connected without a Mercury server", async () => {
    expect(await status({ servers: [] })).toBe("not_connected");
  });

  it("is not_connected when the login is none", async () => {
    expect(await status({ login: "none" })).toBe("not_connected");
  });

  it("is needs_reconnect for a reconnect login or a flagged state", async () => {
    expect(await status({ login: "reconnect" })).toBe("needs_reconnect");
    expect(await status({ state: { needsReconnect: true } })).toBe("needs_reconnect");
  });

  it("is error when the last error is newer than the last sync", async () => {
    expect(
      await status({
        state: { lastSyncedAt: new Date(1000), lastErrorAt: new Date(2000) },
      }),
    ).toBe("error");
  });

  it("is ok otherwise", async () => {
    expect(
      await status({
        state: { lastSyncedAt: new Date(2000), lastErrorAt: new Date(1000) },
      }),
    ).toBe("ok");
  });

  it("resolves even when the sync never settles", async () => {
    vi.useFakeTimers();
    try {
      syncSafesForUser.mockReturnValue(new Promise(() => undefined));
      const result = fundraisingOverview(
        { ...overviewDeps({}), safeCallToolFor: vi.fn() as never },
        actor,
      );
      await vi.advanceTimersByTimeAsync(20_000);
      expect((await result).mercury.status).toBe("ok");
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits ~4s on the overview while the SAFE list still waits up to 20s", async () => {
    vi.useFakeTimers();
    try {
      syncSafesForUser.mockReturnValue(new Promise(() => undefined));
      const overview = fundraisingOverview(
        { ...overviewDeps({}), safeCallToolFor: vi.fn() as never },
        actor,
      );
      const safes = safesList(deps, actor);
      let overviewDone = false;
      let safesDone = false;
      void overview.then(() => {
        overviewDone = true;
      });
      void safes.then(() => {
        safesDone = true;
      });
      await vi.advanceTimersByTimeAsync(4_000);
      expect(overviewDone).toBe(true);
      expect(safesDone).toBe(false);
      await vi.advanceTimersByTimeAsync(16_000);
      expect(await safes).toEqual([{ id: "safe-1" }]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("fundraisingRefresh", () => {
  it("forces the sync and passes the caller's signal", async () => {
    syncSafesForUser.mockResolvedValue("synced");
    const signal = new AbortController().signal;
    await fundraisingRefresh(deps, actor, signal);
    expect(syncSafesForUser.mock.calls.at(-1)?.[2]).toMatchObject({ force: true, signal });
  });
});
