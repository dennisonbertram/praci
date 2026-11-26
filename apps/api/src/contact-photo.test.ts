import type { Actor } from "@rakazo/contracts";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { mountContactPhoto } from "./contact-photo.js";

const actor = (userId: string): Actor => ({
  userId,
  spaceId: "space-1",
  email: `${userId}@rakazo.test`,
  isDeploymentOwner: false,
});
const rows = [
  {
    spaceId: "space-1",
    userId: "user-1",
    email: "ann@example.test",
    storageKey: "k1",
    contentType: "image/png",
  },
  {
    spaceId: "space-1",
    userId: "user-2",
    email: "bo@example.test",
    storageKey: "k2",
    contentType: "image/png",
  },
];
const prisma = {
  contactPhoto: {
    findUnique: async ({
      where: { spaceId_userId_email: key },
    }: {
      where: { spaceId_userId_email: { spaceId: string; userId: string; email: string } };
    }) =>
      rows.find(
        (r) => r.spaceId === key.spaceId && r.userId === key.userId && r.email === key.email,
      ) ?? null,
  },
} as never;
const blobs = new Map([
  ["k1", new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  ["k2", new Uint8Array([1])],
]);
const artifacts = {
  get: async (id: string) => {
    const bytes = blobs.get(id);
    if (!bytes) throw new Error("missing");
    return bytes;
  },
};

function app(who: Actor | null) {
  const hono = new Hono();
  mountContactPhoto(hono, { prisma, artifacts }, async () => who);
  return hono;
}
const get = (who: Actor | null, email: string) =>
  app(who).request(`/api/contacts/photo?email=${encodeURIComponent(email)}`);

describe("GET /api/contacts/photo", () => {
  it("serves the signed-in user's own photo with private, short cache headers", async () => {
    const response = await get(actor("user-1"), "Ann@Example.test");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe("sandbox; default-src 'none'");
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body).toEqual(blobs.get("k1"));
    expect(response.headers.get("content-length")).toBe(String(body.byteLength));
  });

  it("returns 404 without leaking the error when the stored blob is missing", async () => {
    rows.push({
      spaceId: "space-1",
      userId: "user-1",
      email: "gone@example.test",
      storageKey: "no-blob",
      contentType: "image/png",
    });
    const response = await get(actor("user-1"), "gone@example.test");
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).not.toContain("missing");
    expect(JSON.parse(text)).toEqual({ error: "Not found" });
  });

  it("returns 404 for another user's photo and for an address with none", async () => {
    expect((await get(actor("user-1"), "bo@example.test")).status).toBe(404);
    expect((await get(actor("user-1"), "nobody@example.test")).status).toBe(404);
    expect((await get(actor("user-1"), "")).status).toBe(404);
  });

  it("returns 401 without a session", async () => {
    expect((await get(null, "ann@example.test")).status).toBe(401);
  });
});
