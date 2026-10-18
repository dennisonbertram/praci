import { triageStatus } from "@rakazo/adapters";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { grantInboxAiConsent } from "./e2e-consent.js";

// The row the real gate (`triageStatus`) looks for is the one the helper writes.
function setup() {
  const rows = new Set<string>();
  const prisma = {
    spaceMember: { findMany: vi.fn(async () => [{ spaceId: "space" }]) },
    bot: { findFirst: vi.fn(async () => null) },
    aiDataConsent: {
      findFirst: vi.fn(async ({ where }: { where: { recipientKey: string; version: string } }) =>
        rows.has(`${where.recipientKey}:${where.version}`) ? { userId: "user" } : null,
      ),
      upsert: vi.fn(async ({ create }: { create: { recipientKey: string; version: string } }) =>
        rows.add(`${create.recipientKey}:${create.version}`),
      ),
    },
  };
  const resolveModel = vi.fn(async () => ({ provider: "openrouter", id: "vendor/model" }));
  return {
    deps: { prisma, resolveModel } as unknown as Parameters<typeof triageStatus>[0],
    prisma,
  };
}

describe("grantInboxAiConsent", () => {
  it("makes the Inbox gate refuse before it runs and pass after", async () => {
    const { deps, prisma } = setup();
    const scope = { userId: "user", spaceId: "space" };
    expect((await triageStatus(deps, scope)).blocked?.reason).toBe("needs_consent");

    expect(await grantInboxAiConsent(deps, "user")).toBe(1);
    expect(prisma.aiDataConsent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user",
          spaceId: "space",
          version: AI_DISCLOSURE_VERSION,
        }),
      }),
    );
    expect((await triageStatus(deps, scope)).blocked).toBeNull();
    // Already allowed: nothing more to write.
    expect(await grantInboxAiConsent(deps, "user")).toBe(0);
  });
});
