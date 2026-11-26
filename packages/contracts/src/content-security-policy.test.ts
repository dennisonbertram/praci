import { describe, expect, it } from "vitest";
import {
  APP_CONTENT_SECURITY_POLICY,
  contentSecurityPolicyFor,
  HTML_VIEWER_PATH,
} from "./content-security-policy.js";

function directives(policy: string) {
  return new Map(
    policy.split(";").map((part) => {
      const [name = "", ...sources] = part.trim().split(/\s+/);
      return [name, sources] as const;
    }),
  );
}

describe("app content security policy", () => {
  const policy = directives(APP_CONTENT_SECURITY_POLICY);

  it("runs only same-origin script files", () => {
    expect(policy.get("script-src")).toEqual(["'self'"]);
    expect(policy.get("default-src")).toEqual(["'self'"]);
    expect(APP_CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
  });

  it("locks down plugins, base URLs, forms and framing of the app", () => {
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("talks only to its own origin, which hosts the API, RPC, monitoring tunnel and screen proxy", () => {
    expect(policy.get("connect-src")).toEqual(["'self'"]);
    expect(policy.get("frame-src")).toEqual(["'self'", "blob:"]);
  });

  it("does not apply to proxied responses that carry their own policy", () => {
    for (const path of ["/api", "/api/monitoring/tunnel", "/rpc/me", "/novnc/session/view/x"]) {
      expect(contentSecurityPolicyFor(path)).toBeNull();
    }
    expect(contentSecurityPolicyFor("/apiary")).toBe(APP_CONTENT_SECURITY_POLICY);
    expect(contentSecurityPolicyFor("/")).toBe(APP_CONTENT_SECURITY_POLICY);
    expect(contentSecurityPolicyFor("/bots/123")).toBe(APP_CONTENT_SECURITY_POLICY);
  });

  it("lets only the app frame the HTML viewer shell, whose own meta CSP governs it", () => {
    expect(contentSecurityPolicyFor(HTML_VIEWER_PATH)).toBe("frame-ancestors 'self'");
  });
});
