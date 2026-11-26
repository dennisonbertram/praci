import { describe, expect, it } from "vitest";
import { sanitizeModelConnectionError } from "./model-connection-error.js";

const KEY = "EXAMPLE_PLACEHOLDER_KEY";

describe("sanitizeModelConnectionError", () => {
  it.each([
    ["an sk- key", `Invalid sk-${KEY}`],
    ["a whole bearer token with base64 characters", "Bearer EXAMPLE+PLACE/HOLDER=="],
    ["a basic credential", "Authorization: Basic RVhBTVBMRTpQTEFDRUhPTERFUg=="],
    ["a JSON error body", `Invalid {"api_key": "${KEY}"}`],
    ["an escaped JSON body", `{\\"api_key\\": \\"${KEY}\\"}`],
    ["a camel-case key with spaces around =", `apiKey = ${KEY}`],
    ["a single-quoted value", `api-key: '${KEY}'`],
    ["a quoted value with a space", `{"api_key": "EXAMPLE ${KEY}"}`],
    ["a quoted value with a comma and brace", `api_key: "EX,AMPLE}${KEY}" rest`],
    ["a single-quoted value with a space", `api_key='EXAMPLE ${KEY}'`],
    ["an x-api-key header", `x-api-key: ${KEY}`],
    ["a token field", `{"access_token":"${KEY}"}`],
    ["a client secret", `client_secret=${KEY}&grant_type=x`],
    ["a password", `password: ${KEY}`],
    ["a key in a query string", `GET https://models.example.test/v1?key=${KEY} failed`],
    ["URL userinfo", `connect to https://user:${KEY}@models.example.test failed`],
  ])("hides %s", (_label, raw) => {
    const cleaned = sanitizeModelConnectionError(raw);
    expect(cleaned).not.toMatch(/PLACEHOLDER|PLACE\/HOLDER|RVhBTVBMRT/);
    expect(cleaned).toContain("•••");
  });

  it("keeps the text around a hidden value", () => {
    expect(sanitizeModelConnectionError(`{"api_key": "${KEY}", "code": 401}`)).toBe(
      '{"api_key": •••, "code": 401}',
    );
  });

  it("hides the credential the connection was tried with wherever it appears", () => {
    const typed = "plain-typed-value-1234";
    expect(
      sanitizeModelConnectionError(`401: key ${typed} is not valid (${typed.slice(0, 6)})`, [
        typed,
      ]),
    ).toBe("401: key ••• is not valid (plain-)");
  });

  it("ignores a known value too short to hide without blanking ordinary words", () => {
    expect(sanitizeModelConnectionError("401 unauthorized", ["4", "", undefined, null])).toBe(
      "401 unauthorized",
    );
  });

  it("leaves token counts readable", () => {
    expect(sanitizeModelConnectionError("max_tokens: 4096 is too large")).toBe(
      "max_tokens: 4096 is too large",
    );
  });

  it("stays fast on hostile text", () => {
    const started = performance.now();
    for (const raw of [
      `token: "${"a".repeat(100_000)}`,
      "api_key=".repeat(20_000),
      "a-".repeat(50_000),
      `Bearer ${"x".repeat(100_000)}`,
    ]) {
      sanitizeModelConnectionError(raw);
    }
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
