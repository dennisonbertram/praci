import { describe, expect, it } from "vitest";
import { isAllowedMcpOAuthRedirect, pickReturnOrigin } from "./env.js";

const env = {
  webOrigin: "http://127.0.0.1:5273",
  trustedOrigins: ["https://my-mac.example.ts.net"],
};
const pick = (headers: Record<string, string>) => pickReturnOrigin(env, new Headers(headers));

describe("pickReturnOrigin", () => {
  it("uses a trusted Origin header", () => {
    expect(pick({ origin: "https://my-mac.example.ts.net" })).toBe("https://my-mac.example.ts.net");
  });
  it("uses a trusted forwarded host and takes the scheme from the trusted entry", () => {
    expect(pick({ "x-forwarded-host": "my-mac.example.ts.net" })).toBe(
      "https://my-mac.example.ts.net",
    );
    expect(pick({ "x-forwarded-host": "MY-MAC.example.ts.net:443" })).toBe(
      "https://my-mac.example.ts.net",
    );
  });
  it("uses the first forwarded host when a proxy chain lists several", () => {
    expect(pick({ "x-forwarded-host": "my-mac.example.ts.net, 127.0.0.1:3200" })).toBe(
      "https://my-mac.example.ts.net",
    );
  });
  it("falls back to webOrigin for an untrusted host", () => {
    expect(pick({ origin: "https://evil.example" })).toBe(env.webOrigin);
    expect(pick({ "x-forwarded-host": "evil.example" })).toBe(env.webOrigin);
  });
  it("falls back when there are no headers", () => {
    expect(pick({})).toBe(env.webOrigin);
  });
  it("matches the webOrigin host and normalizes its default port", () => {
    expect(pick({ origin: "http://127.0.0.1:5273" })).toBe(env.webOrigin);
    expect(
      pickReturnOrigin(
        { webOrigin: "http://app.example.test", trustedOrigins: [] },
        new Headers({ "x-forwarded-host": "app.example.test:80" }),
      ),
    ).toBe("http://app.example.test");
  });
  it("rejects an Origin with the wrong scheme", () => {
    expect(pick({ origin: "http://my-mac.example.ts.net" })).toBe(env.webOrigin);
  });
  it("rejects a host with a path, userinfo, query or other junk", () => {
    for (const host of [
      "my-mac.example.ts.net/evil",
      "evil.example@my-mac.example.ts.net",
      "my-mac.example.ts.net?x=1",
      "my-mac.example.ts.net#x",
      "my-mac.example.ts.net:99999",
      "",
    ]) {
      expect(pick({ "x-forwarded-host": host })).toBe(env.webOrigin);
    }
    expect(pick({ origin: "https://my-mac.example.ts.net/path" })).toBe(env.webOrigin);
    expect(pick({ origin: "https://evil.example@my-mac.example.ts.net" })).toBe(env.webOrigin);
  });
  it("falls back for a non-matching port", () => {
    expect(pick({ "x-forwarded-host": "my-mac.example.ts.net:8443" })).toBe(env.webOrigin);
  });
  it("ignores the request when headers are missing entirely", () => {
    expect(pickReturnOrigin(env, undefined)).toBe(env.webOrigin);
  });
});

describe("isAllowedMcpOAuthRedirect", () => {
  const ok = (uri: string, headers: Record<string, string> = {}) =>
    isAllowedMcpOAuthRedirect(env, new Headers(headers), uri);
  const tailnet = { "x-forwarded-host": "my-mac.example.ts.net" };

  it("accepts the exact native callback and the web callback on webOrigin", () => {
    expect(ok("rakazo://mcp/oauth/callback")).toBe(true);
    expect(ok("http://127.0.0.1:5273/mcp/oauth/callback")).toBe(true);
  });
  it("accepts the tailnet web callback only when the request selects that origin", () => {
    const uri = "https://my-mac.example.ts.net/mcp/oauth/callback";
    expect(ok(uri, tailnet)).toBe(true);
    expect(ok(uri, { origin: "https://my-mac.example.ts.net" })).toBe(true);
    expect(ok(uri)).toBe(false);
    expect(ok("http://127.0.0.1:5273/mcp/oauth/callback", tailnet)).toBe(false);
  });
  it.each([
    "rakazo://mcp/oauth/callback/",
    "rakazo://mcp/oauth/callback?x=1",
    "RAKAZO://mcp/oauth/callback",
    "rakazo://other",
    "rakazo://mcp/oauth/other",
    "https://evil.example/mcp/oauth/callback",
    "http://my-mac.example.ts.net/mcp/oauth/callback",
    "",
  ])("rejects %j", (uri) => {
    expect(ok(uri, tailnet)).toBe(false);
  });
});
