import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));

import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("says just now for anything under a minute, never 0m ago", () => {
    expect(formatRelativeTime("2026-10-16T11:59:10Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-16T11:59:01Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-16T11:59:00Z", now)).toBe("1m ago");
  });
});
