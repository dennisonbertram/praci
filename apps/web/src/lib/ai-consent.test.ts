import type { AiConsentStatus } from "@rakazo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  status: vi.fn(),
  allow: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("./rpc", () => ({ rpc: { aiConsent: calls } }));

import { allowRecipient, revokeRecipient } from "./ai-consent";

const status = (allowed: boolean): AiConsentStatus => ({
  scope: "scope-1",
  version: "2026-09-14",
  recipients: [
    { key: "model-key", name: "OpenRouter", use: "model", detail: "", allowed },
    { key: "other-key", name: "TypeSafe", use: "model", detail: "", allowed: false },
  ],
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("allowRecipient", () => {
  it("allows exactly the named recipient under the scope and version the server just reported", async () => {
    calls.status.mockResolvedValue(status(false));
    calls.allow.mockResolvedValue(status(true));

    await expect(allowRecipient("model-key")).resolves.toEqual(status(true));

    expect(calls.allow).toHaveBeenCalledTimes(1);
    expect(calls.allow).toHaveBeenCalledWith({
      scope: "scope-1",
      version: "2026-09-14",
      keys: ["model-key"],
    });
  });

  it("allows nothing when the status cannot be read", async () => {
    calls.status.mockRejectedValue(new Error("offline"));
    await expect(allowRecipient("model-key")).rejects.toThrow("offline");
    expect(calls.allow).not.toHaveBeenCalled();
  });
});

describe("revokeRecipient", () => {
  it("revokes only the named recipient, never every permission", async () => {
    calls.revoke.mockResolvedValue(status(false));
    await revokeRecipient("model-key");
    expect(calls.revoke).toHaveBeenCalledWith({ key: "model-key" });
  });
});
