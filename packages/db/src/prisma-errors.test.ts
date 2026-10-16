import { describe, expect, it } from "vitest";
import { Prisma } from "./client.js";
import { isRecordNotFound, isUniqueViolation } from "./prisma-errors.js";

describe("prisma error guards", () => {
  it("matches plain objects and Prisma errors by code", () => {
    const prismaError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test" });
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation(prismaError("P2002"))).toBe(true);
    expect(isRecordNotFound({ code: "P2025" })).toBe(true);
    expect(isRecordNotFound(prismaError("P2025"))).toBe(true);
  });

  it("rejects other codes, null and non-objects", () => {
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isRecordNotFound({ code: "P2002" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});
