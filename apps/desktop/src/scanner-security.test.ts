import { describe, expect, it } from "vitest";
import { scannerIpcAuthorized } from "./scanner-security.js";

describe("scanner IPC authorization", () => {
  const frame = { url: "https://server.example.test/app" };

  it("requires the main window, its main frame, and the trusted server origin", () => {
    expect(scannerIpcAuthorized(true, frame, frame, "https://server.example.test")).toBe(true);
    expect(scannerIpcAuthorized(false, frame, frame, "https://server.example.test")).toBe(false);
    expect(
      scannerIpcAuthorized(true, { url: frame.url }, frame, "https://server.example.test"),
    ).toBe(false);
    expect(scannerIpcAuthorized(true, frame, frame, "https://other.example.test")).toBe(false);
    expect(scannerIpcAuthorized(true, frame, frame, null)).toBe(false);
    expect(scannerIpcAuthorized(true, frame, frame, "null")).toBe(false);
  });
});
