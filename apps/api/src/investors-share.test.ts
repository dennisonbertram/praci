import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const claim = vi.hoisted(() => vi.fn());
const complete = vi.hoisted(() => vi.fn());
const release = vi.hoisted(() => vi.fn());
const share = vi.hoisted(() => vi.fn());
const deliver = vi.hoisted(() => vi.fn());

vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  claimShareRequest: claim,
  completeShareRequest: complete,
  releaseShareRequest: release,
  shareDocuments: share,
}));
vi.mock("./investor-send.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./investor-send.js")>()),
  deliverPortalLinks: deliver,
}));

import { ShareRequestConflictError } from "@rakazo/db";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};
const requestKey = "11111111-1111-4111-8111-111111111111";
const input = { itemId: "item-1", contactIds: ["c1"], emailLink: true, requestKey };

function client() {
  const deps = { prisma: {} as PrismaClient, env: {}, dataDir: "/tmp/x" } as unknown as RouterDeps;
  return createRouterClient(createRouter(deps), { context: { actor } });
}

describe("investors.share request key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claim.mockResolvedValue("claimed");
    share.mockResolvedValue({
      items: [{ itemId: "item-1", shared: true }],
      added: new Map([["c1", ["F"]]]),
    });
    deliver.mockResolvedValue({ links: [{ contactId: "c1", name: "A", link: "l" }] });
  });

  it("completes the key after a delivery", async () => {
    const res = await client().investors.share(input);
    expect(res.links).toHaveLength(1);
    expect(complete).toHaveBeenCalledWith(expect.anything(), actor, requestKey);
    expect(release).not.toHaveBeenCalled();
  });

  it("releases the key and rethrows when the delivery fails", async () => {
    deliver.mockRejectedValue(new Error("mail down"));
    await expect(client().investors.share(input)).rejects.toThrow();
    expect(release).toHaveBeenCalledWith(expect.anything(), actor, requestKey);
    expect(complete).not.toHaveBeenCalled();
  });

  it("sends nothing for an already delivered key", async () => {
    claim.mockResolvedValue("delivered");
    expect(await client().investors.share(input)).toEqual({ links: [] });
    expect(share).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  it("answers CONFLICT and sends nothing while the first call is in flight", async () => {
    claim.mockRejectedValue(new ShareRequestConflictError("This delivery is already in progress"));
    await expect(client().investors.share(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(share).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
});
