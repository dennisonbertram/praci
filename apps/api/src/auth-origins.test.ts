import { createAuth } from "@rakazo/auth";
import { describe, expect, it } from "vitest";
import { isTrustedOrigin, MOBILE_AUTH_ORIGINS } from "./app.js";

// Better Auth skips its origin middleware under NODE_ENV=test, so check the
// matcher that production uses for callback URLs and request origins.
async function trusted(url: string) {
  const auth = createAuth({} as never, {
    secret: "offline-auth-secret-at-least-32-characters",
    baseURL: "https://api.example.test",
    webOrigin: "https://app.example.test",
    signupsEnabled: undefined,
    signupAllowlist: undefined,
    extraOrigins: MOBILE_AUTH_ORIGINS,
  });
  return (await auth.$context).isTrustedOrigin(url);
}

const env = {
  webOrigin: "http://127.0.0.1:5173",
  apiUrl: "http://127.0.0.1:3100",
  authUrl: "http://127.0.0.1:5173",
};

describe("CORS origins", () => {
  it("allows the configured site, its loopback twin, and the mobile dev servers", () => {
    for (const origin of [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:3100",
      "http://localhost:8081",
      "http://127.0.0.1:19006",
      "http://[::1]:8081",
      "rakazo://sign-in",
      "",
    ]) {
      expect(isTrustedOrigin(origin, env), origin).toBe(true);
    }
  });

  it("accepts the configured site when env values keep a trailing slash", () => {
    const envWithSlash = {
      webOrigin: "http://127.0.0.1:5173/",
      apiUrl: "http://127.0.0.1:3100/",
      authUrl: "http://127.0.0.1:5173/",
    };
    expect(isTrustedOrigin("http://127.0.0.1:5173", envWithSlash)).toBe(true);
    expect(isTrustedOrigin("http://localhost:5173", envWithSlash)).toBe(true);
  });

  it("rejects any other loopback port and any public origin", () => {
    for (const origin of [
      "http://127.0.0.1:9",
      "http://localhost:45173",
      "http://[::1]:9",
      "https://evil.example",
      "exp://192.168.1.20:8081",
    ]) {
      expect(isTrustedOrigin(origin, env), origin).toBe(false);
    }
  });
});

describe("extra trusted origins", () => {
  const withExtra = { ...env, trustedOrigins: ["https://box.ts.net"] };

  it("accepts a listed origin for CORS and Better Auth, and nothing else", async () => {
    expect(isTrustedOrigin("https://box.ts.net", withExtra)).toBe(true);
    expect(isTrustedOrigin("https://box.ts.net", env)).toBe(false);
    expect(isTrustedOrigin("https://evil.example", withExtra)).toBe(false);
    const auth = createAuth({} as never, {
      secret: "offline-auth-secret-at-least-32-characters",
      baseURL: "https://api.example.test",
      webOrigin: "https://app.example.test",
      signupsEnabled: undefined,
      signupAllowlist: undefined,
      extraOrigins: [...MOBILE_AUTH_ORIGINS, ...withExtra.trustedOrigins],
    });
    const ctx = await auth.$context;
    expect(ctx.isTrustedOrigin("https://box.ts.net/sign-in")).toBe(true);
    expect(ctx.isTrustedOrigin("https://evil.example/sign-in")).toBe(false);
  });
});

describe("mobile auth origins", () => {
  it("does not trust an arbitrary Expo host as a callback", async () => {
    for (const url of [
      "exp://attacker.example.test:19000/--/verification-lure",
      "exp://192.168.1.20:8081",
      "exp://",
    ]) {
      expect(await trusted(url), url).toBe(false);
    }
  });

  it("keeps the app scheme, Expo web dev server and web origin", async () => {
    for (const url of [
      "rakazo://sign-in",
      "http://localhost:8081/sign-in",
      "https://app.example.test/sign-in",
    ]) {
      expect(await trusted(url), url).toBe(true);
    }
  });
});
