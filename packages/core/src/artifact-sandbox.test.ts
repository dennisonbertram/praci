import { describe, expect, it } from "vitest";
import { SANDBOXED_ARTIFACT_CSP, SANDBOXED_EMAIL_CSP, withSandboxedArtifactCsp } from "./artifact-sandbox.js";

describe("withSandboxedArtifactCsp", () => {
  it("keeps a leading doctype ahead of the CSP meta tag", () => {
    const html = "<!doctype html><html><head></head><body>hi</body></html>";
    const wrapped = withSandboxedArtifactCsp(html);
    expect(wrapped.toLowerCase().startsWith("<!doctype html>")).toBe(true);
    const metaAt = wrapped.indexOf('<meta http-equiv="Content-Security-Policy"');
    expect(metaAt).toBe("<!doctype html>".length);
    expect(wrapped.indexOf("<html>")).toBeGreaterThan(metaAt);
    expect(wrapped).toContain(SANDBOXED_ARTIFACT_CSP);
  });

  it("adds a standards-mode doctype when the fragment has none", () => {
    const wrapped = withSandboxedArtifactCsp("<p>content</p>");
    expect(wrapped.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(wrapped).toContain(SANDBOXED_ARTIFACT_CSP);
    expect(wrapped).toContain("default-src 'none'");
    expect(wrapped.endsWith("<p>content</p>")).toBe(true);
  });

  it("allows no network loads, only inline and data content", () => {
    expect(SANDBOXED_ARTIFACT_CSP).toContain("img-src data:;");
    expect(SANDBOXED_ARTIFACT_CSP).toContain("font-src data:;");
    expect(SANDBOXED_ARTIFACT_CSP).not.toContain("https:");
  });

  it("does not insert the CSP tag inside a quoted doctype", () => {
    const html = '<!DOCTYPE html SYSTEM "x>y"><script>evil()</script>';
    const wrapped = withSandboxedArtifactCsp(html);
    expect(wrapped.startsWith("<!DOCTYPE html><meta")).toBe(true);
    expect(wrapped.endsWith(html)).toBe(true);
    expect(wrapped).not.toContain("x<meta");
  });

  it("does not splice the meta tag into a comment that looks like <head>", () => {
    const html = "<!-- <head> --><script>evil()</script>";
    const wrapped = withSandboxedArtifactCsp(html);
    expect(wrapped.startsWith("<!DOCTYPE html><meta")).toBe(true);
    expect(wrapped.endsWith(html)).toBe(true);
  });

  it("email mode allows https and data images only, with no script and no other network", () => {
    const wrapped = withSandboxedArtifactCsp("<p>mail</p>", { email: true });
    expect(wrapped).toContain(`content="${SANDBOXED_EMAIL_CSP}"`);
    expect(wrapped).not.toContain(SANDBOXED_ARTIFACT_CSP);
    expect(SANDBOXED_EMAIL_CSP).toContain("img-src data: https:;");
    expect(SANDBOXED_EMAIL_CSP).toContain("script-src 'none'");
    expect(SANDBOXED_EMAIL_CSP).toContain("default-src 'none'");
    expect(SANDBOXED_EMAIL_CSP).toContain("font-src data:;");
    expect(SANDBOXED_EMAIL_CSP).not.toContain("http:");
  });

  it("keeps artifacts blocked from remote images unless email mode is asked for", () => {
    expect(withSandboxedArtifactCsp("<p>x</p>")).toContain("img-src data:;");
    expect(withSandboxedArtifactCsp("<p>x</p>", {})).toContain(SANDBOXED_ARTIFACT_CSP);
  });
});
