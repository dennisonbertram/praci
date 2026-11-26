import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { ComputerLimitError, SpaceDeletionInProgressError } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const legal = vi.hoisted(() => ({
  legalOverview: vi.fn(),
  legalConsent: vi.fn(),
  legalConsentGrant: vi.fn(),
}));

vi.mock("./legal.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./legal.js")>()),
  ...legal,
}));

import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};

function client() {
  const deps = {
    prisma: {},
    env: {
      defaultProvider: "fake",
      defaultModel: "fake-model",
      webOrigin: "http://127.0.0.1:5173",
      screenProxySecret: "fake-test-secret",
      sandboxProvider: "fake",
    },
    dataDir: "/tmp/rakazo-router-test",
  } as unknown as RouterDeps;
  return createRouterClient(createRouter(deps), { context: { actor } });
}

describe("legal handlers that create the Legal agent", () => {
  beforeEach(() => vi.resetAllMocks());

  it("overview answers a computer limit as a bad request", async () => {
    legal.legalOverview.mockRejectedValue(new ComputerLimitError(1));
    await expect(client().legal.overview()).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("consent answers a space being deleted as a conflict", async () => {
    legal.legalConsent.mockRejectedValue(new SpaceDeletionInProgressError());
    await expect(client().legal.consent()).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("consentGrant answers a space being deleted as a conflict", async () => {
    legal.legalConsentGrant.mockRejectedValue(new SpaceDeletionInProgressError());
    await expect(
      client().legal.consentGrant({ key: "legal-scan", version: "1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("other errors pass through unchanged", async () => {
    legal.legalOverview.mockRejectedValue(new Error("database unavailable"));
    await expect(client().legal.overview()).rejects.toThrow("database unavailable");
  });
});
