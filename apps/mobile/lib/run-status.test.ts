import { describe, expect, it } from "vitest";
import { botRowStatus, dismissedRunErrorIds, workingStatus } from "./run-status";
import { runErrorText } from "./user-error";

const at = "2026-10-11T00:00:00.000Z";

describe("botRowStatus", () => {
  it("says what each run state is", () => {
    expect(botRowStatus({ status: "queued" })).toBe("Waiting in line…");
    expect(botRowStatus({ status: "running" })).toBe("Working…");
    expect(botRowStatus({ status: "waiting_input" })).toBe("Needs an answer");
    expect(botRowStatus({ status: "waiting_takeover" })).toBe("Needs you");
    expect(botRowStatus({ status: "idle" })).toBeNull();
  });

  it("prefers the run phase and never names the model", () => {
    expect(
      botRowStatus({ status: "running", runPhase: { kind: "model_wait", name: "gpt-6", at } }),
    ).toBe("Waiting for the model…");
  });

  it("shows an undismissed error only", () => {
    expect(botRowStatus({ status: "idle", runErrorId: "run-9" })).toBe("Error");
    dismissedRunErrorIds.add("run-9");
    expect(botRowStatus({ status: "idle", runErrorId: "run-9" })).toBeNull();
  });
});

describe("workingStatus", () => {
  it("uses the reported step and its service", () => {
    expect(
      workingStatus({
        kind: "tool",
        label: "Mail search",
        detail: "Searching mail",
        service: "Gmail",
      }),
    ).toEqual({ text: "Searching mail", waitingOn: "Gmail" });
  });

  it("names what a phase waits on", () => {
    expect(workingStatus({ kind: "phase", phase: { kind: "computer_wait", at } })).toEqual({
      text: "Waiting for the computer",
      waitingOn: "the computer",
    });
  });
});

describe("runErrorText", () => {
  it("turns a provider 401 into words", () => {
    expect(runErrorText('401: {"code":401}')).toMatch(/did not accept your API key/);
    expect(runErrorText("member exploded")).toBe("member exploded");
    expect(runErrorText("Invalid `x()` invocation in /app/db.ts:1:2")).toBe(
      "Something went wrong. Try again.",
    );
    expect(runErrorText("Couldn't reach muse-spark-1.3. Try again.")).toBe(
      "Couldn't reach muse-spark-1.3. Try again.",
    );
  });
});
