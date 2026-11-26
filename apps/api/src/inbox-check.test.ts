import { MailProviderError } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { checkMailConnection } from "./inbox.js";

const actor = { spaceId: "s1", userId: "u1" } as never;

function deps(listLabels: () => Promise<unknown>) {
  const upsert = vi.fn().mockResolvedValue({});
  return {
    upsert,
    deps: {
      prisma: { mailSyncState: { upsert } },
      mail: { listAccounts: async () => [{ id: "c1" }], listLabels },
    } as never,
  };
}

describe("checkMailConnection", () => {
  it("clears a stale reconnect flag when Gmail accepts the token", async () => {
    const { deps: d, upsert } = deps(async () => []);
    await expect(checkMailConnection(d, actor, "c1")).resolves.toEqual({ needsReconnect: false });
    expect(upsert.mock.calls[0]?.[0].update).toMatchObject({
      needsReconnect: false,
      lastErrorAt: null,
    });
  });

  it("sets the flag when Gmail refuses the token", async () => {
    const { deps: d, upsert } = deps(async () => {
      throw new MailProviderError("auth", "revoked");
    });
    await expect(checkMailConnection(d, actor, "c1")).resolves.toEqual({ needsReconnect: true });
    expect(upsert.mock.calls[0]?.[0].update).toMatchObject({ needsReconnect: true });
  });

  it("leaves the flag alone on an outage", async () => {
    const { deps: d, upsert } = deps(async () => {
      throw new MailProviderError("unavailable", "down");
    });
    await expect(checkMailConnection(d, actor, "c1")).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
