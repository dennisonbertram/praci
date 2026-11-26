import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { grantReference, parseGrantReference, pickedSpace, pickKey } from "./mcp.js";

/** Just the verification lookup `pickedSpace` makes, over rows kept in memory. */
function store(rows: Array<{ identifier: string; value: string; expiresAt: Date }>) {
  return {
    verification: {
      findFirst: async ({ where }: { where: { identifier: string; expiresAt: { gt: Date } } }) =>
        rows.find((r) => r.identifier === where.identifier && r.expiresAt > where.expiresAt.gt) ??
        null,
    },
  } as unknown as PrismaClient;
}

describe("pickedSpace", () => {
  const live = new Date(Date.now() + 60_000);

  it("gives a Space only to the client that picked it, in the same session", async () => {
    const prisma = store([
      { identifier: pickKey("s1", "client-a"), value: "space-1", expiresAt: live },
    ]);
    expect(await pickedSpace(prisma, "s1", "client-a")).toBe("space-1");
    expect(await pickedSpace(prisma, "s1", "client-b")).toBeUndefined();
    expect(await pickedSpace(prisma, "s2", "client-a")).toBeUndefined();
  });

  it("ignores an expired pick and a request without a client", async () => {
    const prisma = store([
      {
        identifier: pickKey("s1", "client-a"),
        value: "space-1",
        expiresAt: new Date(Date.now() - 1),
      },
    ]);
    expect(await pickedSpace(prisma, "s1", "client-a")).toBeUndefined();
    expect(await pickedSpace(prisma, "s1", undefined)).toBeUndefined();
  });
});

describe("grant references", () => {
  it("carries the Space and the grant, and reads them back", () => {
    expect(parseGrantReference(grantReference("space-1", "grant-1"))).toEqual({
      spaceId: "space-1",
      grantId: "grant-1",
    });
  });

  it("reads a reference from before grants had ids as no grant", () => {
    for (const legacy of [undefined, "", "space-1", "space-1:", ":grant-1"]) {
      expect(parseGrantReference(legacy)).toBeUndefined();
    }
  });
});
