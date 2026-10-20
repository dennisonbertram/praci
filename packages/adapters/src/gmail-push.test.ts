import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createGmailPushVerifier,
  createGoogleKeyResolver,
  gmailPushConfigFromEnv,
  parseGmailPushNotification,
} from "./gmail-push.js";

const AUDIENCE = "https://rakazo.example.test/api/v1/mail/push";
const SERVICE_ACCOUNT = "push@example-project.iam.gserviceaccount.com";
const NOW = Date.parse("2026-11-14T12:00:00Z");
const nowSeconds = Math.floor(NOW / 1000);

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function token(
  claims: Record<string, unknown> = {},
  options: { alg?: string; kid?: string | null; key?: KeyObject; signature?: string } = {},
) {
  const header = {
    alg: options.alg ?? "RS256",
    ...(options.kid === null ? {} : { kid: options.kid ?? "key-1" }),
    typ: "JWT",
  };
  const body = {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    email: SERVICE_ACCOUNT,
    email_verified: true,
    exp: nowSeconds + 600,
    ...claims,
  };
  const input = `${b64(header)}.${b64(body)}`;
  const signature =
    options.signature ??
    (options.alg === "none"
      ? ""
      : createSign("RSA-SHA256")
          .update(input)
          .sign(options.key ?? pair.privateKey)
          .toString("base64url"));
  return `${input}.${signature}`;
}

const keys = async (kid: string) => (kid === "key-1" ? pair.publicKey : undefined);
const verifier = (extra: Partial<Parameters<typeof createGmailPushVerifier>[1]> = {}) =>
  createGmailPushVerifier(
    { serviceAccount: SERVICE_ACCOUNT, audience: AUDIENCE },
    { keys, now: () => NOW, ...extra },
  );
const bearer = (jwt: string) => `Bearer ${jwt}`;

describe("Gmail push token verifier", () => {
  it("accepts a correctly signed token", async () => {
    expect(await verifier()(bearer(token()))).toBe(true);
  });

  it("accepts an audience list that includes ours and a differently cased service account", async () => {
    const verify = verifier();
    expect(await verify(bearer(token({ aud: ["other", AUDIENCE] })))).toBe(true);
    expect(await verify(bearer(token({ email: SERVICE_ACCOUNT.toUpperCase() })))).toBe(true);
    expect(await verify(bearer(token({ iss: "accounts.google.com" })))).toBe(true);
  });

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a Basic header", "Basic abc"],
    ["a token without a signature part", `Bearer ${token().split(".").slice(0, 2).join(".")}`],
    ["a lowercase scheme", `bearer ${token()}`],
  ])("rejects %s", async (_name, header) => {
    expect(await verifier()(header)).toBe(false);
  });

  it("rejects algorithms other than RS256", async () => {
    const verify = verifier();
    expect(await verify(bearer(token({}, { alg: "none" })))).toBe(false);
    expect(await verify(bearer(token({}, { alg: "HS256", signature: "c2ln" })))).toBe(false);
  });

  it("rejects a signature from a different key, a missing kid and an unknown kid", async () => {
    const verify = verifier();
    expect(await verify(bearer(token({}, { key: otherPair.privateKey })))).toBe(false);
    expect(await verify(bearer(token({}, { kid: null })))).toBe(false);
    expect(await verify(bearer(token({}, { kid: "key-2" })))).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const [head, , signature] = token().split(".");
    const forged = b64({
      iss: "https://accounts.google.com",
      aud: AUDIENCE,
      email: "attacker@example.test",
      email_verified: true,
      exp: nowSeconds + 600,
    });
    expect(await verifier()(bearer(`${head}.${forged}.${signature}`))).toBe(false);
  });

  it.each([
    ["the wrong audience", { aud: "https://other.example.test/push" }],
    ["an audience list without ours", { aud: ["a", "b"] }],
    ["the wrong service account", { email: "other@example-project.iam.gserviceaccount.com" }],
    ["an unverified email", { email_verified: false }],
    ["a missing email_verified", { email_verified: undefined }],
    ["an expired token", { exp: nowSeconds - 60 }],
    ["a missing expiry", { exp: undefined }],
    ["the wrong issuer", { iss: "https://issuer.example.test" }],
  ])("rejects %s", async (_name, claims) => {
    expect(await verifier()(bearer(token(claims)))).toBe(false);
  });

  it("allows a little clock skew", async () => {
    expect(await verifier()(bearer(token({ exp: nowSeconds - 10 })))).toBe(true);
  });

  it("returns false instead of throwing when the key lookup fails", async () => {
    const verify = verifier({
      keys: async () => {
        throw new Error("network down");
      },
    });
    expect(await verify(bearer(token()))).toBe(false);
  });
});

describe("Google signing keys", () => {
  const jwk = { ...(pair.publicKey.export({ format: "jwk" }) as object), kid: "key-1" };

  it("caches for an hour and refetches an unknown kid at most once a minute", async () => {
    let now = NOW;
    const fetchJwks = vi.fn(async () => ({ keys: [jwk] }));
    const resolve = createGoogleKeyResolver({ fetchJwks, now: () => now });
    expect(await resolve("key-1")).toBeDefined();
    expect(await resolve("key-1")).toBeDefined();
    expect(fetchJwks).toHaveBeenCalledTimes(1);

    expect(await resolve("unknown")).toBeUndefined();
    expect(fetchJwks).toHaveBeenCalledTimes(1);
    now += 61_000;
    expect(await resolve("unknown")).toBeUndefined();
    expect(fetchJwks).toHaveBeenCalledTimes(2);
    expect(await resolve("another")).toBeUndefined();
    expect(fetchJwks).toHaveBeenCalledTimes(2);

    now += 3_600_000;
    expect(await resolve("key-1")).toBeDefined();
    expect(fetchJwks).toHaveBeenCalledTimes(3);
  });

  it("returns undefined when the fetch fails and tries again after a minute", async () => {
    let now = NOW;
    const fetchJwks = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ keys: [jwk] });
    const resolve = createGoogleKeyResolver({ fetchJwks, now: () => now });
    expect(await resolve("key-1")).toBeUndefined();
    expect(await resolve("key-1")).toBeUndefined();
    now += 61_000;
    expect(await resolve("key-1")).toBeDefined();
  });
});

describe("Gmail push configuration", () => {
  const origin = "https://rakazo.example.test";
  const topic = "projects/example-project/topics/example-mail";

  it("is off without a topic, without a service account, or with a malformed topic", () => {
    expect(gmailPushConfigFromEnv({}, origin)).toBeUndefined();
    expect(gmailPushConfigFromEnv({ GMAIL_PUSH_TOPIC: topic }, origin)).toBeUndefined();
    expect(
      gmailPushConfigFromEnv(
        { GMAIL_PUSH_TOPIC: "my-topic", GMAIL_PUSH_SERVICE_ACCOUNT: SERVICE_ACCOUNT },
        origin,
      ),
    ).toBeUndefined();
    expect(
      gmailPushConfigFromEnv({ GMAIL_PUSH_SERVICE_ACCOUNT: SERVICE_ACCOUNT }, origin),
    ).toBeUndefined();
  });

  it("defaults the audience to the push URL on the web origin and accepts an override", () => {
    const env = { GMAIL_PUSH_TOPIC: topic, GMAIL_PUSH_SERVICE_ACCOUNT: SERVICE_ACCOUNT };
    expect(gmailPushConfigFromEnv(env, origin)).toEqual({
      topic,
      serviceAccount: SERVICE_ACCOUNT,
      audience: "https://rakazo.example.test/api/v1/mail/push",
    });
    expect(
      gmailPushConfigFromEnv({ ...env, GMAIL_PUSH_AUDIENCE: "custom-audience" }, origin)?.audience,
    ).toBe("custom-audience");
  });
});

describe("parseGmailPushNotification", () => {
  const body = (data: unknown) =>
    JSON.stringify({ message: { data: Buffer.from(JSON.stringify(data)).toString("base64") } });

  it("returns the mailbox address and ignores other fields", () => {
    expect(
      parseGmailPushNotification(body({ emailAddress: "me@example.test", historyId: 7 })),
    ).toBe("me@example.test");
  });

  it("returns undefined for anything unreadable", () => {
    expect(parseGmailPushNotification("not json")).toBeUndefined();
    expect(parseGmailPushNotification(body("garbage"))).toBeUndefined();
    expect(parseGmailPushNotification(body({ emailAddress: 5 }))).toBeUndefined();
    expect(
      parseGmailPushNotification(JSON.stringify({ message: { data: "!!!" } })),
    ).toBeUndefined();
  });
});
