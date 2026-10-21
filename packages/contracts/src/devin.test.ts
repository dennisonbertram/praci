import { describe, expect, it } from "vitest";
import { devinSessionUrl, isDevinSessionUrl } from "./devin.js";

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
