import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));

import { kindSection, prLabel, sourceLabel, statusLabel, waitingLabel } from "./devin-format";

describe("prLabel", () => {
  it("shortens a GitHub pull request URL to owner/repo#n and keeps the state", () => {
    expect(prLabel({ url: "https://github.com/acme/api/pull/212", state: "open" })).toEqual({
      ref: "acme/api#212",
      state: "open",
    });
  });
  it("falls back to the host for any other URL, and to the text when it is not a URL", () => {
    expect(
      prLabel({ url: "https://gitlab.example.com/acme/api/-/merge_requests/3", state: "merged" })
        .ref,
    ).toBe("gitlab.example.com");
    expect(prLabel({ url: "not a url", state: "" }).ref).toBe("not a url");
  });
});

describe("sourceLabel", () => {
  it("names Devin's origins and calls anything else Other", () => {
    expect(sourceLabel("code_scan")).toBe("Code scan");
    expect(sourceLabel("webapp")).toBe("Web");
    expect(sourceLabel("slack")).toBe("Slack");
    expect(sourceLabel("something_new")).toBe("Other");
    expect(sourceLabel("")).toBe("Other");
  });
});

describe("statusLabel", () => {
  it("uses one word per kind and the raw text for an unknown status", () => {
    expect(statusLabel("needs_you", "blocked")).toBe("Needs input");
    expect(statusLabel("error", "failed")).toBe("Error");
    expect(statusLabel("finished", "finished")).toBe("Finished");
    expect(statusLabel("unknown", "daydreaming")).toBe("daydreaming");
    expect(statusLabel("unknown", "")).toBe("Unknown");
  });
});

describe("kindSection", () => {
  it("puts error rows under Needs you and every finished-like kind under Earlier", () => {
    expect(kindSection("needs_you")).toBe("needs_you");
    expect(kindSection("error")).toBe("needs_you");
    expect(kindSection("working")).toBe("working");
    expect(kindSection("finished")).toBe("earlier");
    expect(kindSection("suspended")).toBe("earlier");
    expect(kindSection("unknown")).toBe("earlier");
  });
});

describe("waitingLabel", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("counts minutes, hours and days since the update", () => {
    expect(waitingLabel("2026-10-21T11:15:00Z", now)).toBe("Waiting 45m");
    expect(waitingLabel("2026-10-21T09:00:00Z", now)).toBe("Waiting 3h");
    expect(waitingLabel("2026-10-18T12:00:00Z", now)).toBe("Waiting 3d");
  });
  it("never says 0m", () => {
    expect(waitingLabel("2026-10-21T11:59:50Z", now)).toBe("Waiting 1m");
  });
});
