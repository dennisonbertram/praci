import type { AdapterContext } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { classifyBotWall } from "./bot-wall.js";
import { builtinAgentTools } from "./builtin-tools.js";
import { KeylessHttpWebProvider } from "./keyless-http-web.js";
import { webFetchFromTool } from "./web-tools.js";

const ctx: AdapterContext = {
  operationId: "1",
  traceId: "1",
  spaceId: "w",
  userId: "u",
  signal: new AbortController().signal,
};
const publicResolver = async () => [{ address: "203.0.113.10", family: 4 as const }];

// Invented fixture pages.
const challengePage = `<html><head><title>Just a moment...</title></head><body>
<h1>Checking your browser before accessing example.test</h1>
<div class="cf-turnstile" data-sitekey="fake"></div>
<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script></body></html>`;
const rateLimitPage = `<html><head><title>429</title></head><body><h1>Too Many Requests</h1><p>Rate limit exceeded.</p></body></html>`;
const loginPage = `<html><head><title>Sign in</title></head><body><p>Please sign in to continue.</p></body></html>`;
const longNormalPage = `<html><head><title>Field notes</title>
<script src="/cdn-cgi/challenge-platform/h/b/scripts/jsd/main.js"></script>
<script src="https://www.google.com/recaptcha/api.js"></script></head><body><article>
${"<p>This is an ordinary paragraph about gardening and soil, long enough to be real content.</p>".repeat(60)}
</article><div class="g-recaptcha" data-sitekey="fake"></div></body></html>`;

describe("classifyBotWall", () => {
  it("flags a challenge page as needing a person", () => {
    expect(
      classifyBotWall({ status: 403, headers: new Headers(), body: challengePage }),
    ).toMatchObject({
      kind: "needs_person",
    });
    expect(
      classifyBotWall({ status: 200, headers: new Headers(), body: challengePage }),
    ).toMatchObject({
      kind: "needs_person",
    });
  });
  it("flags the challenge header even with an empty body", () => {
    const headers = new Headers({ "cf-mitigated": "challenge" });
    expect(classifyBotWall({ status: 403, headers, body: "" })?.kind).toBe("needs_person");
  });
  it("flags rate limits as transient", () => {
    expect(
      classifyBotWall({ status: 429, headers: new Headers({ "retry-after": "30" }), body: "" }),
    ).toMatchObject({ kind: "transient" });
    expect(
      classifyBotWall({ status: 200, headers: new Headers(), body: rateLimitPage })?.kind,
    ).toBe("transient");
  });
  it("flags a login wall as needing a person", () => {
    expect(classifyBotWall({ status: 401, headers: new Headers(), body: "" })?.kind).toBe(
      "needs_person",
    );
    expect(classifyBotWall({ status: 200, headers: new Headers(), body: loginPage })?.kind).toBe(
      "needs_person",
    );
  });
  it("does not flag a long normal page that embeds challenge scripts", () => {
    expect(
      classifyBotWall({ status: 200, headers: new Headers(), body: longNormalPage }),
    ).toBeNull();
  });
  it("does not flag an ordinary 500 or a plain short page", () => {
    expect(classifyBotWall({ status: 500, headers: new Headers(), body: "oops" })).toBeNull();
    expect(
      classifyBotWall({ status: 200, headers: new Headers(), body: "<p>hello</p>" }),
    ).toBeNull();
  });
});

const page = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new KeylessHttpWebProvider({
    fetch: async () =>
      new Response(body, { status, headers: { "content-type": "text/html", ...headers } }),
    resolveHostname: publicResolver,
  });

describe("web_fetch with a bot wall", () => {
  it("returns a structured needs-person result without the challenge HTML", async () => {
    const result = await webFetchFromTool(page(challengePage, 403), ctx, {
      url: "https://example.test/a",
    });
    expect(result).toMatchObject({
      blocked: { kind: "needs_person", status: 403 },
      url: "https://example.test/a",
    });
    expect(JSON.stringify(result)).not.toContain("cf-turnstile");
    expect(JSON.stringify(result)).toMatch(/request_takeover/);
  });
  it("tells the agent to retry once for a transient wall", async () => {
    const result = await webFetchFromTool(page("", 429, { "retry-after": "5" }), ctx, {
      url: "https://example.test/a",
    });
    expect(result).toMatchObject({ blocked: { kind: "transient", status: 429 } });
    expect(JSON.stringify(result)).toMatch(/once/);
    expect(JSON.stringify(result)).not.toMatch(/request_takeover/);
  });
  it("still returns content for a normal page and errors for a plain 500", async () => {
    const ok = await webFetchFromTool(page(longNormalPage), ctx, { url: "https://example.test/a" });
    expect(ok).toHaveProperty("text");
    expect(ok).not.toHaveProperty("blocked");
    await expect(
      webFetchFromTool(page("oops", 500), ctx, { url: "https://example.test/a" }),
    ).resolves.toEqual({ error: "Request failed: HTTP 500" });
  });
  it("tells the agent about blocked results in the tool description", () => {
    const tool = builtinAgentTools.find((t) => t.name === "web_fetch");
    expect(tool?.description).toMatch(/blocked/);
    expect(tool?.description).toMatch(/request_takeover/);
  });
});
