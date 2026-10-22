import { i18n } from "@lingui/core";
import { beforeAll, describe, expect, it } from "vitest";
import { runPhaseLine, runPhaseWaitingOn } from "./run-phase";

const AT = "2026-01-01T00:00:00.000Z";

describe("run phase copy", () => {
  beforeAll(() => i18n.loadAndActivate({ locale: "en", messages: {} }));

  it("never names the model while waiting for it", () => {
    const phase = { kind: "model_wait", name: "vendor/secret-model-1", at: AT } as const;
    expect(runPhaseLine(phase)).toBe("Waiting for the model");
    expect(runPhaseWaitingOn(phase)).toBe("the model");
  });

  it("never shows why a run is retrying", () => {
    const phase = { kind: "retrying", name: "the database connection dropped", at: AT } as const;
    expect(runPhaseLine(phase)).toBe("Retrying");
  });

  it("names the service being connected", () => {
    expect(runPhaseLine({ kind: "connecting", name: "Notion", at: AT })).toBe(
      "Connecting to Notion",
    );
    expect(runPhaseWaitingOn({ kind: "connecting", at: AT })).toBe("tools");
  });
});
