import { describe, expect, it } from "vitest";
import { confirmationMail, sendConfirmation } from "./email.js";
import { cleanField, hashIp, normalizeEmail, normalizeRef, parseJoinBody } from "./waitlist.js";

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
    expect(parseJoinBody('{"email":"a@b.co","name":"A"}')).toMatchObject({
      email: "a@b.co",
      name: "A",
    });
    expect(parseJoinBody("not json")).toBeNull();
    expect(parseJoinBody({ email: "a@b.co", company: 4 })).toBeNull();
  });

  it("normalizes referral codes", () => {
    expect(normalizeRef(" abcd2345 ")).toBe("ABCD2345");
    expect(normalizeRef("ABC")).toBeNull();
    expect(normalizeRef("ABCD234O")).toBeNull();
    expect(normalizeRef(undefined)).toBeNull();
  });

  it("parses a ref and rejects a non-string ref", () => {
    expect(parseJoinBody({ email: "a@b.co", ref: "ABCD2345" })).toMatchObject({ ref: "ABCD2345" });
    expect(parseJoinBody({ email: "a@b.co", ref: 4 })).toBeNull();
  });

  it("skips the confirmation email without an API key", async () => {
    await expect(sendConfirmation("a@b.co", "tok", "ABCD2345", {})).resolves.toBe(true);
  });
});

describe("confirmation mail", () => {
  const env = { PUBLIC_SITE_URL: "https://example.test/" };
  const mail = confirmationMail("tok_1-2", "ABCD2345", env);
  const links = [
    "https://example.test/you?token=tok_1-2",
    "https://example.test/?ref=ABCD2345",
    "https://github.com/dennisonbertram/praci#quick-start-for-developers",
  ];

  it("has the subject and the same links in html and text", () => {
    expect(mail.subject).toBe("You're on the Praci waitlist");
    for (const link of links) {
      expect(mail.html).toContain(link);
      expect(mail.text).toContain(link);
    }
  });

  it("escapes interpolated values in html", () => {
    const evil = confirmationMail("t", "A", { PUBLIC_SITE_URL: "https://x.test/<b>" });
    expect(evil.html).not.toContain("<b>");
    expect(evil.html).toContain("x.test/&lt;b&gt;");
    expect(evil.html).not.toContain('font-family:"');
  });
});
