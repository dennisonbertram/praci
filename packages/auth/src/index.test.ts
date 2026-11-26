import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  authRateLimitOptions,
  buildTrustedOrigins,
  createAuth,
  isBlockedAuthPath,
  passkeyRpId,
  passwordResetEmail,
  resolveSignupPolicy,
} from "./index.js";

describe("auth policy", () => {
  it("closes every organization plugin route", () => {
    for (const path of [
      "/organization/delete",
      "/organization/update",
      "/organization/leave",
      "/organization/create",
      "/organization/invite-member",
      "/organization/cancel-invitation",
      "/organization/set-active",
      "/organization/list",
      "/organization/create-team",
      "/organization/some-future-route",
      "/organization/add-member",
      "/organization/update-member-role",
      "/organization/remove-member",
      "/organization/set-active-member",
      "/organization/accept-invitation",
      "//organization/add-member",
      "///organization/update-member-role",
      "/organization//remove-member",
      "/Organization/accept-invitation",
      "/%6Frganization/set-active-member",
      "/%E0%A4%A",
    ]) {
      expect(isBlockedAuthPath(path), path).toBe(true);
    }
  });

  it("keeps the account routes the apps call", () => {
    for (const path of [
      "/sign-up/email",
      "/sign-in/email",
      "/sign-out",
      "/get-session",
      "/change-password",
      "/request-password-reset",
      "/reset-password",
      "/delete-user",
      "/callback/oidc",
      "/passkey/generate-register-options",
    ]) {
      expect(isBlockedAuthPath(path), path).toBe(false);
    }
  });

  it("derives the passkey rpID from the web origin, using localhost for loopback", () => {
    expect(passkeyRpId("https://app.example.com")).toBe("app.example.com");
    expect(passkeyRpId("http://127.0.0.1:5273")).toBe("localhost");
    expect(passkeyRpId("http://localhost:5273")).toBe("localhost");
  });

  it("adds passkey routes unless SSO is mandatory", () => {
    const env = {
      secret: "test-secret-that-is-long-enough-for-better-auth",
      baseURL: "http://localhost:3200",
      webOrigin: "http://localhost:5273",
      signupsEnabled: undefined,
      signupAllowlist: undefined,
    };
    expect(createAuth({} as never, env).api).toHaveProperty("listPasskeys");
    const sso = createAuth({} as never, {
      ...env,
      passwordAuth: false,
      oidc: {
        name: "Example",
        issuer: "https://idp.example.com",
        clientId: "c",
        clientSecret: "s",
        scopes: [],
        allowSignupBypass: false,
      },
    });
    expect(sso.api).not.toHaveProperty("listPasskeys");
  });

  it("disables organization deletion inside Better Auth as well", async () => {
    const auth = createAuth({} as never, {
      secret: "test-secret-that-is-long-enough-for-better-auth",
      baseURL: "http://127.0.0.1:3100",
      webOrigin: "http://127.0.0.1:5173",
      signupsEnabled: undefined,
      signupAllowlist: undefined,
    });

    const res = await auth.handler(
      new Request("http://127.0.0.1:3100/api/auth/organization/delete", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
        body: JSON.stringify({ organizationId: "space-1" }),
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "ORGANIZATION_DELETION_DISABLED" });
  });
});

describe("authRateLimitOptions", () => {
  it("caps credential routes at 10 attempts per 15 minutes in a shared table", () => {
    expect(authRateLimitOptions("production")).toEqual({
      enabled: true,
      storage: "database",
      customRules: {
        "/request-account-deletion": { window: 600, max: 3 },
        "/sign-in/email": { window: 15 * 60, max: 10 },
        "/sign-up/email": { window: 15 * 60, max: 10 },
        "/request-password-reset": { window: 15 * 60, max: 10 },
        "/send-verification-email": { window: 15 * 60, max: 10 },
      },
    });
  });

  it("stays off outside production so the test suite can sign in", () => {
    expect(authRateLimitOptions("test").enabled).toBe(false);
  });
});

describe("buildTrustedOrigins", () => {
  it("adds the localhost twin for a 127.0.0.1 web origin", () => {
    expect(
      buildTrustedOrigins({
        webOrigin: "http://127.0.0.1:5173",
        baseURL: "http://127.0.0.1:5173",
      }),
    ).toEqual(expect.arrayContaining(["http://127.0.0.1:5173", "http://localhost:5173"]));
  });

  it("keeps extraOrigins and does not twin non-loopback hosts", () => {
    expect(
      buildTrustedOrigins({
        webOrigin: "https://app.example.test",
        baseURL: "https://api.example.test",
        extraOrigins: ["https://extra.example.test"],
      }),
    ).toEqual([
      "https://app.example.test",
      "https://api.example.test",
      "https://extra.example.test",
    ]);
  });
});

describe("passwordResetEmail", () => {
  it("keeps the reset URL in text and escapes user-controlled HTML", () => {
    const message = passwordResetEmail(
      { id: "user-1", email: "ada@example.test", name: '<Ada & "team">' },
      "https://rakazo.test/reset-password?token=secret&next=1",
    );

    expect(message).toMatchObject({
      to: "ada@example.test",
      subject: "Reset your Praci password",
    });
    expect(message.text).toContain("https://rakazo.test/reset-password?token=secret&next=1");
    expect(message.html).toContain("&lt;Ada &amp; &quot;team&quot;&gt;");
    expect(message.html).toContain("token=secret&amp;next=1");
    expect(message.html).not.toContain('<Ada & "team">');
  });
});

describe("resolveSignupPolicy", () => {
  it("uses environment defaults before deployment settings exist", async () => {
    const prisma = {
      deploymentSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    await expect(
      resolveSignupPolicy(prisma as never, {
        signupsEnabled: "false",
        signupAllowlist: "you@example.com,@company.test",
      }),
    ).resolves.toEqual({
      enabled: false,
      allowlist: ["you@example.com", "@company.test"],
    });
  });

  it("keeps using the environment policy for a pre-upgrade uninitialized row", async () => {
    const prisma = {
      deploymentSettings: {
        findUnique: vi.fn().mockResolvedValue({
          signupsEnabled: true,
          signupAllowlist: "",
          signupPolicyInitialized: false,
        }),
      },
    };
    await expect(
      resolveSignupPolicy(prisma as never, {
        signupsEnabled: "false",
        signupAllowlist: "existing-policy@example.com",
      }),
    ).resolves.toEqual({ enabled: false, allowlist: ["existing-policy@example.com"] });
  });

  it("uses live deployment settings as the effective policy after initial seeding", async () => {
    const prisma = {
      deploymentSettings: {
        findUnique: vi.fn().mockResolvedValue({
          signupsEnabled: false,
          signupAllowlist: "approved@example.com",
          signupPolicyInitialized: true,
        }),
      },
    };
    await expect(
      resolveSignupPolicy(prisma as never, {
        signupsEnabled: "false",
        signupAllowlist: "environment-only@example.com",
      }),
    ).resolves.toEqual({ enabled: false, allowlist: ["approved@example.com"] });
  });
});

describe("session lifetime", () => {
  it("lasts 90 days and renews after a day of use, keeping the one-day fresh window", async () => {
    const auth = createAuth({} as never, {
      secret: "test-secret-that-is-long-enough-for-better-auth",
      baseURL: "http://127.0.0.1:3100",
      webOrigin: "http://127.0.0.1:5173",
      signupsEnabled: undefined,
      signupAllowlist: undefined,
    });
    const { sessionConfig } = await auth.$context;
    expect(sessionConfig).toMatchObject({
      expiresIn: 90 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      freshAge: 24 * 60 * 60,
    });
  });
});

describe("bearer sessions", () => {
  const secret = "offline-auth-secret-at-least-32-characters";
  const token = "fakeSessionToken0123456789abcdef";

  function authWithSessionLookups() {
    const lookups: unknown[] = [];
    const model = new Proxy(
      {},
      {
        get: () =>
          vi.fn(async (query: unknown) => {
            lookups.push(query);
            return null;
          }),
      },
    );
    const prisma = new Proxy({}, { get: (_target, name) => (name === "then" ? undefined : model) });
    const auth = createAuth(prisma as never, {
      secret,
      baseURL: "https://api.example.test",
      webOrigin: "https://app.example.test",
      signupsEnabled: "true",
      signupAllowlist: "",
    });
    return { auth, lookups };
  }

  function signed(value: string, key = secret) {
    return `${value}.${createHmac("sha256", key).update(value).digest("base64")}`;
  }

  it.each([
    ["a raw session token", token],
    ["a token signed with another key", signed(token, "another-secret-of-at-least-32-chars")],
  ])("never looks up a session for %s", async (_label, bearer) => {
    const { auth, lookups } = authWithSessionLookups();
    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${bearer}` }),
    });
    expect(session).toBeNull();
    expect(JSON.stringify(lookups)).not.toContain(token);
  });

  it.each([
    ["raw", signed(token)],
    ["URL-encoded", encodeURIComponent(signed(token))],
  ])("looks up the session for a %s signed token", async (_label, bearer) => {
    const { auth, lookups } = authWithSessionLookups();
    await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${bearer}` }) });
    expect(JSON.stringify(lookups)).toContain(token);
  });
});
