import { createSign, generateKeyPairSync } from "node:crypto";
import { createGmailPushVerifier } from "@rakazo/adapters";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { MAIL_PUSH_PATH, mountMailPushRoute } from "./mail-push.js";

const AUDIENCE = "https://rakazo.example.test/api/v1/mail/push";
const SERVICE_ACCOUNT = "push@example-project.iam.gserviceaccount.com";
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

function jwt(
  claims: Record<string, unknown> = {},
  options: { alg?: string; key?: typeof pair } = {},
) {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const input = `${b64({ alg: options.alg ?? "RS256", kid: "k1", typ: "JWT" })}.${b64({
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    email: SERVICE_ACCOUNT,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600,
    ...claims,
  })}`;
  const signature =
    options.alg === "none"
      ? ""
      : createSign("RSA-SHA256")
          .update(input)
          .sign((options.key ?? pair).privateKey)
          .toString("base64url");
  return `${input}.${signature}`;
}

const body = (data: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    message: { data: Buffer.from(JSON.stringify(data)).toString("base64"), messageId: "1" },
    subscription: "projects/example-project/subscriptions/mail",
    ...extra,
  });

function setup(wake = vi.fn(async () => 1)) {
  const app = new Hono();
  mountMailPushRoute(app, {
    verify: createGmailPushVerifier(
      { serviceAccount: SERVICE_ACCOUNT, audience: AUDIENCE },
      { keys: async (kid) => (kid === "k1" ? pair.publicKey : undefined) },
    ),
    wake,
  });
  const post = (payload: string, token?: string) =>
    app.request(MAIL_PUSH_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: payload,
    });
  return { app, wake, post };
}
const valid = body({ emailAddress: "Me@Example.test", historyId: "123" });

describe("Gmail push route", () => {
  it.each([
    ["no token", undefined],
    ["a malformed token", "not-a-jwt"],
    ["an unsigned token", jwt({}, { alg: "none" })],
    ["a token signed by another key", jwt({}, { key: other })],
    ["a wrong audience", jwt({ aud: "https://elsewhere.example.test" })],
    ["a wrong service account", jwt({ email: "evil@example-project.iam.gserviceaccount.com" })],
  ])("answers 401 and wakes nothing for %s", async (_name, token) => {
    const { post, wake } = setup();
    expect((await post(valid, token)).status).toBe(401);
    expect(wake).not.toHaveBeenCalled();
  });

  it("wakes the mailbox named in a verified message and answers 204", async () => {
    const { post, wake } = setup();
    const response = await post(valid, jwt());
    expect(response.status).toBe(204);
    expect(wake).toHaveBeenCalledExactlyOnceWith("Me@Example.test");
  });

  it("uses only the address: scope fields in the payload are ignored", async () => {
    const { post, wake } = setup();
    const payload = body(
      {
        emailAddress: "me@example.test",
        historyId: "1",
        spaceId: "s",
        userId: "u",
        connectionId: "c",
      },
      { spaceId: "s", userId: "u", connectionId: "c" },
    );
    await post(payload, jwt());
    expect(wake).toHaveBeenCalledExactlyOnceWith("me@example.test");
  });

  it("acknowledges a verified message it cannot read, without waking anything", async () => {
    const { post, wake } = setup();
    expect((await post(body("garbage"), jwt())).status).toBe(204);
    expect((await post("not json", jwt())).status).toBe(204);
    expect((await post(JSON.stringify({ message: { data: "!!!" } }), jwt())).status).toBe(204);
    expect(wake).not.toHaveBeenCalled();
  });

  it("answers 413 for a body over 64 KB", async () => {
    const { post, wake } = setup();
    const big = body({ emailAddress: "me@example.test" }, { padding: "x".repeat(70 * 1024) });
    expect((await post(big, jwt())).status).toBe(413);
    expect(wake).not.toHaveBeenCalled();
  });

  it("answers 500 when waking fails, so Pub/Sub delivers again", async () => {
    const { post } = setup(
      vi.fn(async () => {
        throw new Error("queue down");
      }),
    );
    expect((await post(valid, jwt())).status).toBe(500);
  });

  it("has no route until it is mounted", async () => {
    const app = new Hono();
    expect((await app.request(MAIL_PUSH_PATH, { method: "POST", body: valid })).status).toBe(404);
  });
});
