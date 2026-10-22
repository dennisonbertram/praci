import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  credentialIssue,
  dismissedThreadRunError,
  isInternalRunError,
  isNetworkFailure,
  isServerUnreachable,
  isTechnicalErrorMessage,
  KEY_REJECTED_PATTERN,
  plainRunError,
  providerErrorMessage,
  threadRunError,
  userErrorMessage,
} from "./user-error.js";

const copy = { fallback: "Could not load bots", offline: "Could not reach the server" };
const authCopy = {
  fallback: "Could not sign up",
  email: "Enter a valid email",
  password: "Enter a password",
};

describe("isServerUnreachable", () => {
  it("counts no connection, timeouts and gateway errors, through causes", () => {
    expect(isServerUnreachable(new TypeError("Network request failed"))).toBe(true);
    const timeout = Object.assign(new Error("Request timed out"), { name: "TimeoutError" });
    expect(isServerUnreachable(timeout)).toBe(true);
    for (const status of [502, 503, 504]) {
      expect(isServerUnreachable(Object.assign(new Error("Bad gateway"), { status }))).toBe(true);
    }
    expect(isServerUnreachable(new Error("Could not reach the server", { cause: timeout }))).toBe(
      true,
    );
  });

  it("leaves answers from the server alone", () => {
    for (const status of [400, 401, 403, 404, 409, 422, 500]) {
      expect(isServerUnreachable(Object.assign(new Error("No"), { status }))).toBe(false);
    }
    expect(isServerUnreachable(new Error("Request canceled"))).toBe(false);
    expect(isServerUnreachable(null)).toBe(false);
  });
});

describe("isNetworkFailure", () => {
  it("recognizes every platform's unreachable-server wording", () => {
    for (const message of [
      "Failed to fetch",
      "NetworkError when attempting to fetch resource.",
      "Load failed",
      "Network request failed",
      "fetch failed",
      "fetch failed: UnexpectedException: Could not connect to the server. (at ExpoModulesCore/Promise.swift:56)",
      "The Internet connection appears to be offline.",
    ]) {
      expect(isNetworkFailure(new TypeError(message))).toBe(true);
    }
  });

  it("follows causes and socket error codes", () => {
    const refused = Object.assign(new Error("connect"), { code: "ECONNREFUSED" });
    expect(isNetworkFailure(new Error("request", { cause: refused }))).toBe(true);
  });

  it("leaves server responses and non-errors alone", () => {
    expect(isNetworkFailure(new Error("Bot not found"))).toBe(false);
    expect(isNetworkFailure("fetch failed")).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});

describe("isTechnicalErrorMessage", () => {
  it("flags validation dumps, exceptions, stack frames, JSON, status dumps, and codes", () => {
    for (const message of [
      "[body.email] Invalid email address; [body.password] Too small: expected string to have >=1 characters",
      "UnexpectedException: something",
      "TypeError: undefined is not a function",
      "Could not open (at ExpoModulesCore/Promise.swift:56)",
      '{"error":"boom"}',
      "rpc bots/list failed",
      "rpc threads/subscribe failed (502)",
      "Voice failed (500)",
      "connect ECONNREFUSED 127.0.0.1:3000",
      "VALIDATION_ERROR",
      "Response body exceeds 262144 bytes",
      "JSON Parse error: Unexpected character: <",
      "Internal Server Error",
      "Internal server error.",
      "Bad Gateway",
    ]) {
      expect(isTechnicalErrorMessage(message), message).toBe(true);
    }
  });

  it("keeps copy written for people", () => {
    for (const message of [
      "Bot not found",
      "Invalid email or password",
      "Request timed out",
      "Update your server to use AI data sharing in this mobile version.",
      "You do not have access to this space",
      "Use a longer password (at least 8 characters)",
    ]) {
      expect(isTechnicalErrorMessage(message), message).toBe(false);
    }
  });
});

describe("userErrorMessage", () => {
  it("says the server is unreachable for transport failures", () => {
    expect(userErrorMessage(new TypeError("Failed to fetch"), copy)).toBe(copy.offline);
  });

  it("passes human messages through and replaces technical ones", () => {
    expect(userErrorMessage(new Error("Bot not found"), copy)).toBe("Bot not found");
    expect(userErrorMessage(new Error("rpc bots/list failed"), copy)).toBe(copy.fallback);
    expect(userErrorMessage(new Error("  "), copy)).toBe(copy.fallback);
    expect(userErrorMessage({ message: "Bot not found" }, copy)).toBe(copy.fallback);
    expect(userErrorMessage("Bot not found", copy)).toBe("Bot not found");
  });
});

describe("credentialIssue", () => {
  it("asks for a well-formed email before a password", () => {
    expect(credentialIssue({ email: "", password: "" })).toBe("email");
    expect(credentialIssue({ email: "ada@", password: "secret" })).toBe("email");
    expect(credentialIssue({ email: "ada@example", password: "secret" })).toBe("email");
    expect(credentialIssue({ email: " ada@example.com ", password: "" })).toBe("password");
    expect(credentialIssue({ email: "ada@example.com", password: "secret" })).toBeNull();
  });

  it("skips the password when the form has none", () => {
    expect(credentialIssue({ email: "ada@example.com" })).toBeNull();
  });
});

describe("authErrorMessage", () => {
  it("maps validation issue paths to field copy", () => {
    expect(
      authErrorMessage(
        {
          code: "VALIDATION_ERROR",
          message:
            "[body.email] Invalid email address; [body.password] Too small: expected string to have >=1 characters",
        },
        authCopy,
      ),
    ).toBe(authCopy.email);
    expect(
      authErrorMessage(
        { code: "VALIDATION_ERROR", message: "[body.password] Too small" },
        authCopy,
      ),
    ).toBe(authCopy.password);
    expect(
      authErrorMessage({ code: "VALIDATION_ERROR", message: "[body.name] Too big" }, authCopy),
    ).toBe(authCopy.fallback);
  });

  it("keeps the server's own auth copy and hides anything technical", () => {
    expect(
      authErrorMessage(
        { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
        authCopy,
      ),
    ).toBe("Invalid email or password");
    expect(authErrorMessage({ message: '{"detail":"x"}' }, authCopy)).toBe(authCopy.fallback);
    expect(authErrorMessage(undefined, authCopy)).toBe(authCopy.fallback);
  });
});

describe("providerErrorMessage", () => {
  const fallback = "The app could not be connected.";
  it("extracts the message from Composio 400 and 404 bodies", () => {
    expect(
      providerErrorMessage(
        '400 {"error":{"message":"Composio does not manage auth for toolkit box_mcp","code":601,"request_id":"abc"}}',
        fallback,
      ),
    ).toBe("Composio does not manage auth for toolkit box_mcp");
    expect(
      providerErrorMessage(
        '404 {"error":{"message":"Connected account \\"box_mcp\\" not found","code":606,"slug":"ConnectedAccount_ResourceNotFound","status":404}}',
        fallback,
      ),
    ).toBe('Connected account "box_mcp" not found');
  });
  it("passes plain text through and falls back on garbage", () => {
    expect(providerErrorMessage("provider unavailable", fallback)).toBe("provider unavailable");
    expect(providerErrorMessage('400 {"oops', fallback)).toBe(fallback);
    expect(providerErrorMessage("   ", fallback)).toBe(fallback);
  });
  it("userErrorMessage cleans a raw stored provider error", () => {
    expect(userErrorMessage(new Error('400 {"error":{"message":"Not allowed here"}}'), copy)).toBe(
      "Not allowed here",
    );
  });
});

describe("run errors", () => {
  const snapshot = (error: string | null, status = "failed") =>
    ({ run: { id: "r1", status, error } }) as unknown as Parameters<typeof threadRunError>[0];
  const describeError = (error: string) =>
    KEY_REJECTED_PATTERN.test(error) ? "key rejected" : error;

  it("recognises a provider 401", () => {
    expect(KEY_REJECTED_PATTERN.test('401 {"error":"bad key"}')).toBe(true);
    expect(KEY_REJECTED_PATTERN.test('{"error":{"code": 401}}')).toBe(true);
    expect(KEY_REJECTED_PATTERN.test("500 upstream")).toBe(false);
  });

  it("shows a failed run's error until dismissed, then keeps a note", () => {
    const snap = snapshot("401 nope");
    expect(threadRunError(snap, describeError)).toBe("key rejected");
    expect(threadRunError(snap, describeError, new Set(["r1"]))).toBeNull();
    expect(dismissedThreadRunError(snap, describeError, new Set(["r1"]))).toBe("key rejected");
    expect(dismissedThreadRunError(snap, describeError, new Set())).toBeNull();
    expect(threadRunError(snapshot(null, "running"), describeError)).toBeNull();
  });
});

describe("isInternalRunError", () => {
  it("flags database and stack-trace text, keeps readable errors", () => {
    expect(
      isInternalRunError(
        "Invalid `tx.run.findUnique()` invocation in /app/packages/db/src/messages.ts:108:28\n\n  105 where: {",
      ),
    ).toBe(true);
    expect(isInternalRunError("boom\n    at Object.run (/srv/app/index.js:10:5)")).toBe(true);
    expect(isInternalRunError("x".repeat(301))).toBe(true);
    expect(isInternalRunError("Couldn't reach muse-spark-1.3. Try again.")).toBe(false);
  });
});

describe("plainRunError", () => {
  const copy = { keyRejected: "KEY", generic: "GENERIC" };
  it("hides a provider 401 JSON body", () => {
    expect(plainRunError('401: {"message":"User not found.","code":401}', copy)).toBe("KEY");
  });
  it("hides a gateway error from the model proxy", () => {
    expect(
      plainRunError(
        "upstream connect error or disconnect/reset before headers. reset reason: connection timeout",
        copy,
      ),
    ).toBe("GENERIC");
  });
  it("hides stack-trace text and keeps human messages", () => {
    expect(plainRunError("x".repeat(400), copy)).toBe("GENERIC");
    expect(plainRunError("Allow it on the Legal page.", copy)).toBe("Allow it on the Legal page.");
  });
});

describe("threadRunError while a delegate waits for approval", () => {
  const snap = (delegatePending?: boolean) =>
    ({
      run: { id: "r1", status: "failed", error: "This agent could not finish. Try again." },
      messages: [],
      delegatePending,
    }) as unknown as Parameters<typeof threadRunError>[0];

  it("shows no failure while the agent this bot asked waits for approval", () => {
    expect(threadRunError(snap(true), (error) => error)).toBeNull();
  });

  it("shows the failure again once the approval is answered or denied", () => {
    expect(threadRunError(snap(false), (error) => error)).toBe(
      "This agent could not finish. Try again.",
    );
  });
});
