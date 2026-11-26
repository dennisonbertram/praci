import type { Actor } from "@rakazo/contracts";
import { OMI_CLOUD_PROVIDER } from "@rakazo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("@rakazo/adapters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/adapters")>()),
  persistPreparedSecret: async (
    _prisma: unknown,
    _secrets: unknown,
    _stored: unknown,
    commit: () => unknown,
  ) => commit(),
  queueMeetingDigests: async () => undefined,
  requestMeetingSync: async () => {
    throw new Error("queue down");
  },
}));
vi.mock("./integration-agent.js", () => ({ provisionConnectionAgent: async () => undefined }));
vi.mock("@rakazo/logging", () => ({ getLogger: () => ({ error: logError }) }));

import type { MeetingsDeps } from "./meetings.js";
import { connectGranola } from "./meetings.js";
import { connectOmiCloud } from "./omi-cloud.js";

const actor = { spaceId: "space-1", userId: "user-1" } as Actor;

function deps(): MeetingsDeps {
  const tx = {
    $executeRaw: async () => 0,
    connection: { findFirst: async () => null, create: async () => ({ id: "conn-1" }) },
    secret: { create: async () => ({}) },
  };
  const source = { create: () => ({ list: async () => ({}) }) };
  return {
    router: {
      env: { agentRuntime: "scripted" },
      secrets: { put: async () => ({ id: "secret-1", ciphertext: "cipher" }) },
      prisma: {
        $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
        connection: { findFirst: async () => ({ agentBotId: null }) },
      },
      jobs: {},
    },
    registry: { granola: source, [OMI_CLOUD_PROVIDER]: source },
    agent: {},
  } as unknown as MeetingsDeps;
}

describe("connect when the first sync cannot be queued", () => {
  beforeEach(() => logError.mockClear());

  it("keeps a committed Granola connect successful", async () => {
    await expect(connectGranola(deps(), actor, { apiKey: "grn-key" })).resolves.toEqual({
      ok: true,
    });
    expect(logError).toHaveBeenCalledWith("meetings.connect: sync not queued", expect.any(Error));
  });

  it("keeps a committed Omi cloud connect successful", async () => {
    await expect(connectOmiCloud(deps(), actor, { apiKey: "omi-dev-key" })).resolves.toEqual({
      ok: true,
    });
    expect(logError).toHaveBeenCalledWith("omiCloud.connect: sync not queued", expect.any(Error));
  });
});
