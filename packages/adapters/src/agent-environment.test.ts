import { SecretStoreUnavailableError } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import {
  decryptAgentEnvironment,
  formatAgentEnvironmentInstruction,
  redactAgentCommandResult,
  redactShellStreams,
} from "./agent-environment.js";

describe("agent-environment", () => {
  it("decrypts named agent secrets", async () => {
    const env = await decryptAgentEnvironment(
      [
        { name: "API_TOKEN", secret: { id: "sec-1", ciphertext: "cipher-1" } },
        { name: "DB_URL", secret: { id: "sec-2", ciphertext: "cipher-2" } },
      ],
      {
        load: async (ciphertext, recordId) => `${recordId}:${ciphertext}`,
      },
    );
    expect(env).toEqual({
      API_TOKEN: "sec-1:cipher-1",
      DB_URL: "sec-2:cipher-2",
    });
  });

  it("skips invalid secret names", async () => {
    const env = await decryptAgentEnvironment(
      [
        { name: "lowercase", secret: { id: "sec", ciphertext: "x" } },
        { name: "GOOD", secret: { id: "sec-2", ciphertext: "y" } },
      ],
      { load: async () => "fake-value" },
    );
    expect(env).toEqual({ GOOD: "fake-value" });
  });

  it("skips rows whose load throws a plain error", async () => {
    const env = await decryptAgentEnvironment(
      [
        { name: "BAD", secret: { id: "sec-bad", ciphertext: "x" } },
        { name: "GOOD", secret: { id: "sec-good", ciphertext: "y" } },
      ],
      {
        load: async (_ciphertext, id) => {
          if (id === "sec-bad") throw new Error("decrypt failed");
          return "fake-value";
        },
      },
    );
    expect(env).toEqual({ GOOD: "fake-value" });
  });

  it("rejects when the secret store is unavailable", async () => {
    await expect(
      decryptAgentEnvironment([{ name: "GOOD", secret: { id: "sec", ciphertext: "x" } }], {
        load: async () => {
          throw new SecretStoreUnavailableError(503);
        },
      }),
    ).rejects.toBeInstanceOf(SecretStoreUnavailableError);
  });

  it("omits reserved names and empty or NUL-containing values", async () => {
    const env = await decryptAgentEnvironment(
      [
        { name: "PATH", secret: { id: "s1", ciphertext: "a" } },
        { name: "LD_PRELOAD", secret: { id: "s2", ciphertext: "b" } },
        { name: "HAS_NUL", secret: { id: "s3", ciphertext: "c" } },
        { name: "EMPTY", secret: { id: "s4", ciphertext: "d" } },
        { name: "GOOD", secret: { id: "s5", ciphertext: "e" } },
      ],
      {
        load: async (_ciphertext, id) =>
          id === "s3" ? "fake\0value" : id === "s4" ? "" : "fake-value",
      },
    );
    expect(env).toEqual({ GOOD: "fake-value" });
  });

  it("formats an instruction only when secrets exist", () => {
    expect(formatAgentEnvironmentInstruction({})).toBeUndefined();
    expect(formatAgentEnvironmentInstruction({ Z: "1", A: "2" })).toContain("A, Z");
  });

  it("redacts secret values from command output", () => {
    expect(
      redactAgentCommandResult(
        { stdout: "token=super-secret", stderr: "super-secret failed", code: 1 },
        ["super-secret"],
      ),
    ).toEqual({
      stdout: expect.not.stringContaining("super-secret"),
      stderr: expect.not.stringContaining("super-secret"),
      code: 1,
    });
  });

  it("redacts a secret split across stdout and stderr", () => {
    const output = redactAgentCommandResult({ stdout: "pre SECR", stderr: "ET123 post", code: 0 }, [
      "SECRET123",
    ]);
    const joined = `${output.stdout}${output.stderr}`;
    expect(joined).toBe("pre [redacted] post");
    expect(joined).not.toContain("SECRET123");
  });

  it("withholds a secret prefix from a running view and emits it when finished", () => {
    const secret = "super-secret-token";
    expect(
      redactShellStreams({ stdout: "prefix super-", stderr: "" }, [secret], {
        withholdPartial: true,
      }),
    ).toEqual({ stdout: "prefix ", stderr: "" });
    expect(redactShellStreams({ stdout: "prefix super-", stderr: "" }, [secret])).toEqual({
      stdout: "prefix super-",
      stderr: "",
    });
  });

  it("withholds a stdout secret prefix when stderr has unrelated text", () => {
    const secret = "super-secret-token";
    expect(
      redactShellStreams({ stdout: "prefix super-", stderr: "unrelated noise" }, [secret], {
        withholdPartial: true,
      }),
    ).toEqual({ stdout: "prefix ", stderr: "unrelated noise" });
    expect(
      redactShellStreams({ stdout: "unrelated", stderr: "tail super-" }, [secret], {
        withholdPartial: true,
      }),
    ).toEqual({ stdout: "unrelated", stderr: "tail " });
  });

  it("withholds an incomplete secret split across stdout and stderr", () => {
    const secret = "ABCDEFGHIJ";
    expect(
      redactShellStreams({ stdout: "ABCDE", stderr: "FGH" }, [secret], { withholdPartial: true }),
    ).toEqual({ stdout: "", stderr: "" });
    expect(
      redactShellStreams({ stdout: "pre ABCDE", stderr: "FGH tail" }, [secret], {
        withholdPartial: true,
      }),
    ).toEqual({ stdout: "pre ", stderr: " tail" });
    const joined = redactShellStreams({ stdout: "ABCDE", stderr: "FGH" }, [secret], {
      withholdPartial: true,
    });
    expect(`${joined.stdout}${joined.stderr}`).toBe("");
    expect(redactShellStreams({ stdout: "ABCDE", stderr: "FGH" }, [secret])).toEqual({
      stdout: "ABCDE",
      stderr: "FGH",
    });
  });
});
