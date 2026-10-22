import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

const { syncSafesForUser, listSafes } = vi.hoisted(() => ({
  syncSafesForUser: vi.fn(),
  listSafes: vi.fn(async () => [{ id: "safe-1" }]),
}));
vi.mock("@rakazo/adapters", () => ({ syncSafesForUser }));
vi.mock("@rakazo/db", async (original) => ({
  ...(await original<object>()),
  listSafes,
}));

const { safesList } = await import("./fundraising.js");

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
});
