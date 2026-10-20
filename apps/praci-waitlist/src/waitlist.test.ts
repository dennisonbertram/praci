import { describe, expect, it } from "vitest";
import { cleanField, hashIp, normalizeEmail, parseJoinBody } from "./waitlist.js";
import { sendConfirmation } from "./email.js";

describe("waitlist helpers", () => {
  it("normalizes and rejects emails", () => {
    expect(normalizeEmail(" Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("person@example")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });

  it("cleans optional fields", () => {
    expect(cleanField("  Acme  ")).toBe("Acme");
    expect(cleanField("   ")).toBeNull();
    expect(cleanField(undefined)).toBeNull();
    expect(cleanField("x".repeat(500))).toHaveLength(100);
  });

  it("hashes IPs to sha256 hex", () => {
    expect(hashIp("203.0.113.1")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.1")).not.toContain("203");
  });

  it("parses bodies", () => {
    expect(parseJoinBody('{"email":"a@b.co","name":"A"}')).toMatchObject({ email: "a@b.co", name: "A" });
    expect(parseJoinBody("not json")).toBeNull();
    expect(parseJoinBody({ email: "a@b.co", company: 4 })).toBeNull();
  });

  it("skips the confirmation email without an API key", async () => {
    await expect(sendConfirmation("a@b.co", {})).resolves.toBeUndefined();
  });
});
