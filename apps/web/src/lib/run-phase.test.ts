import { i18n } from "@lingui/core";
import { beforeAll, describe, expect, it } from "vitest";
import { runPhaseLine, runPhaseWaitingOn } from "./run-phase";

describe("run phase copy", () => {
  beforeAll(() => i18n.loadAndActivate({ locale: "en", messages: {} }));

  it("never names the model while waiting for it", () => {
    const phase = { kind: "model_wait", name: "vendor/secret-model-1" } as const;
    expect(runPhaseLine(phase)).toBe("Waiting for the model");
    expect(runPhaseWaitingOn(phase)).toBe("the model");
  });

  it("names the service being connected", () => {
    expect(runPhaseLine({ kind: "connecting", name: "Notion" })).toBe("Connecting to Notion");
    expect(runPhaseWaitingOn({ kind: "connecting" })).toBe("tools");
  });
});
