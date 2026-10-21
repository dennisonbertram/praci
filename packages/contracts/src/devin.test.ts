import { describe, expect, it } from "vitest";
import {
  DevinKeyInputSchema,
  DevinSessionsOutputSchema,
  devinSessionUrl,
  isDevinSessionUrl,
} from "./devin.js";

describe("Devin session links", () => {
  it("builds the canonical session URL and accepts only that", () => {
    const url = devinSessionUrl("devin-0001");
    expect(url).toBe("https://app.devin.ai/sessions/devin-0001");
    expect(isDevinSessionUrl(url)).toBe(true);
  });

  it("rejects other hosts, paths, schemes, credentials, ports and extras", () => {
    for (const url of [
      "http://app.devin.ai/sessions/devin-0001",
      "https://evil.example/sessions/devin-0001",
      "https://app.devin.ai.evil.example/sessions/devin-0001",
      "https://user:pass@app.devin.ai/sessions/devin-0001",
      "https://app.devin.ai@evil.example/sessions/devin-0001",
      "https://app.devin.ai:8443/sessions/devin-0001",
      "https://app.devin.ai/sessions/",
      "https://app.devin.ai/sessions/a/b",
      "https://app.devin.ai/other/devin-0001",
      "https://app.devin.ai/sessions/devin-0001?x=1",
      "https://app.devin.ai/sessions/devin-0001#top",
      "https://app.devin.ai/sessions/devin 0001",
      "/sessions/devin-0001",
      "",
    ]) {
      expect(isDevinSessionUrl(url), url).toBe(false);
    }
  });

  it("refuses to build a URL from an id with unsafe characters", () => {
    expect(() => devinSessionUrl("../x")).toThrow();
    expect(() => devinSessionUrl("")).toThrow();
  });
});

describe("Devin page contract", () => {
  const none = {
    connection: {
      status: "none",
      manage: true,
      canConnect: true,
      isConnector: false,
      agentBotId: null,
    },
    fetchedAt: null,
    stale: false,
    partial: false,
    sessions: [],
  };

  it("accepts a space with no connection and a session row", () => {
    expect(DevinSessionsOutputSchema.parse(none)).toEqual(none);
    const row = {
      id: "devin-0001",
      title: "Fix the login redirect",
      kind: "needs_you",
      status: "blocked",
      statusDetail: null,
      question: "Which environment?",
      prs: [{ url: "https://github.com/acme/web/pull/1", state: "open" }],
      origin: "webapp",
      updatedAt: "2025-10-09T10:00:00.000Z",
    };
    expect(DevinSessionsOutputSchema.parse({ ...none, sessions: [row] }).sessions).toEqual([row]);
  });

  it("rejects an unknown status or session kind", () => {
    expect(() =>
      DevinSessionsOutputSchema.parse({ ...none, connection: { ...none.connection, status: "x" } }),
    ).toThrow();
    expect(() =>
      DevinSessionsOutputSchema.parse({ ...none, sessions: [{ id: "a", kind: "other" }] }),
    ).toThrow();
  });

  it("trims the key and refuses an empty one", () => {
    expect(DevinKeyInputSchema.parse({ secret: "  key  " })).toEqual({ secret: "key" });
    expect(() => DevinKeyInputSchema.parse({ secret: "   " })).toThrow();
  });
});
