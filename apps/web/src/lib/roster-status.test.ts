import { describe, expect, it, vi } from "vitest";
import {
  compactRosterStatusLabel,
  rosterHasUndismissedRunError,
  rosterHeldFor,
  rosterStatusChanged,
  rosterWorkStatusLabel,
} from "./roster-status";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw(strings, ...values),
}));

describe("rosterHasUndismissedRunError", () => {
  it("shows a failure only until its run ID is dismissed", () => {
    expect(rosterHasUndismissedRunError("run-failed", new Set())).toBe(true);
    expect(rosterHasUndismissedRunError("run-failed", new Set(["run-failed"]))).toBe(false);
    expect(rosterHasUndismissedRunError(null, new Set())).toBe(false);
  });
});

describe("rosterWorkStatusLabel", () => {
  it("names queued, leased, and running work for the sidebar", () => {
    expect(rosterWorkStatusLabel("queued")).toBe("Waiting in line…");
    expect(rosterWorkStatusLabel("leased")).toBe("Starting…");
    expect(rosterWorkStatusLabel("running")).toBe("Working…");
  });

  it("flags a question waiting for the owner", () => {
    expect(rosterWorkStatusLabel("waiting_input")).toBe("Needs your answer");
  });

  it("leaves other statuses to the message preview", () => {
    expect(rosterWorkStatusLabel("idle")).toBeNull();
    expect(rosterWorkStatusLabel("waiting_takeover")).toBeNull();
    expect(rosterWorkStatusLabel("completed")).toBeNull();
    expect(rosterWorkStatusLabel("failed")).toBeNull();
    expect(rosterWorkStatusLabel("cancelled")).toBeNull();
    expect(rosterWorkStatusLabel("")).toBeNull();
  });
});

describe("compactRosterStatusLabel", () => {
  it("keeps work, human-wait, and error states visible without a preview", () => {
    expect(compactRosterStatusLabel("queued")).toBe("Waiting in line…");
    expect(compactRosterStatusLabel("leased")).toBe("Starting…");
    expect(compactRosterStatusLabel("running")).toBe("Working…");
    expect(compactRosterStatusLabel("waiting_input")).toBe("Needs your answer");
    expect(compactRosterStatusLabel("waiting_takeover")).toBe("Needs takeover");
    expect(compactRosterStatusLabel("failed")).toBe("Error");
  });

  it("does not add status text to idle rows", () => {
    expect(compactRosterStatusLabel("idle")).toBeNull();
  });
});

describe("run phase in the sidebar", () => {
  const at = "2026-10-11T00:00:00.000Z";
  it("shows what a queued or running bot waits on", () => {
    expect(rosterWorkStatusLabel("queued", { kind: "computer_wait", at })).toBe(
      "Waiting for the computer…",
    );
    expect(compactRosterStatusLabel("running", { kind: "connecting", name: "Devin", at })).toBe(
      "Connecting to Devin…",
    );
  });

  it("keeps the old labels without a phase or with a silent one", () => {
    expect(rosterWorkStatusLabel("queued", null)).toBe("Waiting in line…");
    expect(rosterWorkStatusLabel("running", { kind: "thinking", at })).toBe("Working…");
    expect(rosterWorkStatusLabel("idle", { kind: "computer_wait", at })).toBeNull();
  });
});

describe("rosterHeldFor", () => {
  it("separates a held question from a computer takeover", () => {
    expect(rosterHeldFor("waiting_input")).toBe("answer");
    expect(rosterHeldFor("waiting_takeover")).toBe("takeover");
    expect(rosterHeldFor("running")).toBeNull();
  });
});

describe("rosterStatusChanged", () => {
  it("refreshes the sidebar when a run pauses for an approval or question", () => {
    expect(rosterStatusChanged({ type: "run.waiting_input" })).toBe(true);
    expect(rosterStatusChanged({ type: "run.started" })).toBe(true);
    expect(rosterStatusChanged({ type: "run.completed" })).toBe(true);
    expect(rosterStatusChanged({ type: "thread.message.created" })).toBe(false);
  });
});

it("names a delegate wait", async () => {
  const { waitingForApprovalLabel } = await import("./roster-status");
  expect(waitingForApprovalLabel()).toBe("Waiting for approval");
});
