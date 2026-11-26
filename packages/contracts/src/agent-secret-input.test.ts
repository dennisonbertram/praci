import { describe, expect, it } from "vitest";
import { AgentSecretInputSchema } from "./domain.js";

describe("AgentSecretInputSchema", () => {
  it("accepts an ordinary secret", () => {
    expect(AgentSecretInputSchema.safeParse({ name: "API_TOKEN", value: "x" }).success).toBe(true);
  });

  it("rejects reserved environment variable names", () => {
    expect(AgentSecretInputSchema.safeParse({ name: "PATH", value: "x" }).success).toBe(false);
    expect(AgentSecretInputSchema.safeParse({ name: "RAKAZO_X", value: "x" }).success).toBe(false);
  });

  it("rejects a NUL character in the value", () => {
    expect(AgentSecretInputSchema.safeParse({ name: "OK", value: "a\0b" }).success).toBe(false);
  });
});
