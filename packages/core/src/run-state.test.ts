import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  hasRunPhaseLine,
  isBackgroundRunTrigger,
  isConversationalRun,
  isRunWorking,
} from "./run-state.js";

describe("run state machine", () => {
  it("allows takeover resume onto a lease", () => {
    expect(canTransition("waiting_takeover", "leased")).toBe(true);
    expect(canTransition("waiting_takeover", "running")).toBe(false);
  });

  it("withholds user steering from routine, webhook, and creation intro turns", () => {
    expect(isConversationalRun("user")).toBe(true);
    expect(isConversationalRun("follow_up")).toBe(true);
    expect(isConversationalRun("messaging")).toBe(true);
    expect(isConversationalRun("routine")).toBe(false);
    expect(isConversationalRun("webhook")).toBe(false);
    expect(isConversationalRun("created")).toBe(false);
    expect(isConversationalRun("tickets")).toBe(false);
  });

  it("marks ticket runs as background work that stays out of the chat", () => {
    expect(isBackgroundRunTrigger("tickets")).toBe(true);
    expect(isBackgroundRunTrigger("user")).toBe(false);
    expect(isBackgroundRunTrigger("routine")).toBe(false);
    expect(isBackgroundRunTrigger(null)).toBe(false);
  });

  it("rejects rewriting a completed run", () => {
    expect(() => assertTransition("completed", "running")).toThrow(/illegal/i);
  });

  it("never leaves a terminal state except failed retry", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("completed" as const, "cancelled" as const),
        fc.constantFrom(
          "queued" as const,
          "leased" as const,
          "running" as const,
          "waiting_input" as const,
          "completed" as const,
        ),
        (from, to) => {
          expect(canTransition(from, to)).toBe(false);
        },
      ),
    );
  });
});

describe("isRunWorking", () => {
  it("counts only runs the bot is executing or about to execute", () => {
    for (const status of ["queued", "leased", "running"] as const) {
      expect(isRunWorking(status)).toBe(true);
    }
    for (const status of ["waiting_input", "waiting_takeover", "failed", "completed"] as const) {
      expect(isRunWorking(status)).toBe(false);
    }
    expect(isRunWorking(undefined)).toBe(false);
  });
});

describe("hasRunPhaseLine", () => {
  it("is true for phases that name something awaited", () => {
    const at = "2026-10-11T00:00:00.000Z";
    expect(hasRunPhaseLine({ kind: "model_wait", at })).toBe(true);
    expect(hasRunPhaseLine({ kind: "retrying", at })).toBe(true);
    expect(hasRunPhaseLine({ kind: "thinking", at })).toBe(false);
  });
});
