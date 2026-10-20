import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateReferralCode,
  generateToken,
  hashToken,
  normalizeEmail,
  normalizeRef,
  parseJoinBody,
  parseTokenBody,
} from "./waitlist.js";

describe("waitlist helpers", () => {
  it("normalizes and rejects emails", () => {
    expect(normalizeEmail(" Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("person@example")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });

  it("generates codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("normalizes refs and drops malformed ones", () => {
    expect(normalizeRef("abcd2345")).toBe("ABCD2345");
    expect(normalizeRef("short")).toBeNull();
    expect(normalizeRef("ABCD234O")).toBeNull();
    expect(normalizeRef(undefined)).toBeNull();
  });

  it("hashes tokens to sha256 hex and never stores the token", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });

  it("parses bodies", () => {
    expect(parseJoinBody('{"email":"a@b.co","ref":"X"}')).toEqual({
      email: "a@b.co",
      ref: "X",
      contactNote: undefined,
    });
    expect(parseJoinBody("not json")).toBeNull();
    expect(parseJoinBody({ email: "a@b.co", ref: 4 })).toBeNull();
    expect(parseTokenBody('{"token":"abc"}')).toBe("abc");
    expect(parseTokenBody('{"token":""}')).toBeNull();
    expect(parseTokenBody("[]")).toBeNull();
  });
});
