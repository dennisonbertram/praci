import { createRouterClient } from "@orpc/server";
import type { CompanyImportEngine } from "@rakazo/adapters";
import type { Actor, CompanyImportProgress } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "owner@example.test",
  isDeploymentOwner: true,
};

const progress: CompanyImportProgress = {
  runId: "run-1",
  status: "running",
  tokenCap: 100,
  reservedTokens: 0,
  inputTokensUsed: 0,
  outputTokensUsed: 0,
  budgetWarning: false,
  counts: { waiting: 1 },
  sources: [],
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-02T03:04:05.000Z",
};

describe("company import RPC", () => {
  it("dispatches owner actions and streams the initial snapshot plus owner progress events", async () => {
    const follow = vi.fn(async function* () {
      yield progress;
    });
    const engine = {
      create: vi.fn(async () => progress),
      progress: vi.fn(async () => progress),
      consentStatus: vi.fn(async () => ({
        allowed: false,
        consentKey: "consent-key",
        sourceKind: "data_room",
        recipient: {
          key: "synthetic/model",
          name: "Synthetic model",
          detail: "Synthetic disclosure",
          privacyUrl: null,
        },
        version: "2026-01",
      })),
      grantConsent: vi.fn(async () => ({
        allowed: true,
        consentKey: "consent-key",
        sourceKind: "data_room",
        recipient: {
          key: "synthetic/model",
          name: "Synthetic model",
          detail: "Synthetic disclosure",
          privacyUrl: null,
        },
        version: "2026-01",
      })),
      start: vi.fn(async () => progress),
      action: vi.fn(async () => progress),
      follow,
    } as unknown as CompanyImportEngine;
    const client = createRouterClient(
      createRouter({ companyImport: engine, env: {} } as unknown as RouterDeps),
      { context: { actor } },
    );

    const created = await client.companyImport.create({
      tokenCap: 100,
      sources: [{ sourceKind: "data_room" }],
    });
    expect(created).toEqual(progress);
    expect(engine.create).toHaveBeenCalledWith(actor, {
      tokenCap: 100,
      sources: [{ sourceKind: "data_room", scope: {} }],
    });
    expect(await client.companyImport.start({ runId: "run-1" })).toEqual(progress);
    expect(engine.start).toHaveBeenCalledWith(actor, "run-1");
    const consentStatus = await client.companyImport.consentStatus({
      runId: "run-1",
      sourceId: "source-1",
    });
    expect(consentStatus.allowed).toBe(false);
    const grantInput = {
      runId: "run-1",
      sourceId: "source-1",
      consentKey: "consent-key",
      version: "2026-01",
      sourceKind: "data_room" as const,
      recipient: {
        key: "synthetic/model",
        name: "Synthetic model",
        detail: "Synthetic disclosure",
        privacyUrl: null,
      },
    };
    await client.companyImport.grantConsent(grantInput);
    expect(engine.grantConsent).toHaveBeenCalledWith(actor, grantInput);
    expect(await client.companyImport.action({ runId: "run-1", action: "pause" })).toEqual(
      progress,
    );
    expect(engine.action).toHaveBeenCalledWith(actor, "run-1", "pause", undefined);

    const stream = await client.companyImport.subscribe({ runId: "run-1" });
    const events = [];
    for await (const event of stream) events.push(event);
    expect(events).toEqual([progress, progress]);
    expect(engine.progress).toHaveBeenCalledWith(actor, "run-1");
    expect(follow).toHaveBeenCalledWith(actor, "run-1", undefined);
  });
});
