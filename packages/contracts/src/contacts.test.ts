import { describe, expect, it } from "vitest";
import { ContactKindSchema, ContactSaveInputSchema } from "./contacts.js";

describe("ContactSaveInputSchema", () => {
  it("trims the name and lowercases the email", () => {
    expect(
      ContactSaveInputSchema.parse({ name: "  Ada Fund  ", email: " ADA@Example.TEST " }),
    ).toMatchObject({ name: "Ada Fund", email: "ada@example.test" });
  });

  it("rejects a bad email, an empty name and an unknown kind", () => {
    expect(ContactSaveInputSchema.safeParse({ name: "A", email: "not-an-email" }).success).toBe(
      false,
    );
    expect(ContactSaveInputSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(ContactKindSchema.safeParse("friend").success).toBe(false);
    for (const kind of ["auditor", "customer", "vendor", "partner", "advisor", "legal"])
      expect(ContactKindSchema.safeParse(kind).success).toBe(true);
  });

  it("limits organization and notes", () => {
    expect(
      ContactSaveInputSchema.safeParse({ name: "A", organization: "x".repeat(201) }).success,
    ).toBe(false);
    expect(ContactSaveInputSchema.safeParse({ name: "A", notes: "x".repeat(5001) }).success).toBe(
      false,
    );
  });
});
