import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};

function setup(withEmail: boolean) {
  const send = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    space: { findUnique: vi.fn().mockResolvedValue({ name: "Acme" }) },
    contact: { findFirst: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient;
  const deps = {
    prisma,
    env: { webOrigin: "http://127.0.0.1:5173" },
    dataDir: "/tmp/rakazo-router-test",
    email: withEmail ? { send } : undefined,
  } as unknown as RouterDeps;
  const client = createRouterClient(createRouter(deps), { context: { actor } });
  return { client, send };
}

describe("investors.portalResend", () => {
  it.each([true, false])(
    "answers not found for a contact that is not the owner's (email provider: %s)",
    async (withEmail) => {
      const { client, send } = setup(withEmail);
      await expect(client.investors.portalResend({ contactId: "ghost" })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Contact not found",
      });
      expect(send).not.toHaveBeenCalled();
    },
  );
});

type Row = { [key: string]: unknown };

/** Prisma stand-in for the share path: items, share rows, the contact lock and token minting. */
function setupShare({ items = [] as Row[], shares = [] as Row[], contacts = [] as Row[] }) {
  const send = vi.fn().mockResolvedValue(undefined);
  const created: Row[] = [];
  const prisma = {
    space: { findUnique: vi.fn().mockResolvedValue({ name: "Acme" }) },
    dataRoomItem: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        items.filter((i) => where.id.in.includes(i.id as string)),
      ),
    },
    investorShare: {
      findMany: vi.fn(async () => shares),
      createMany: vi.fn(async ({ data }: { data: Row[] }) => {
        created.push(...data);
        return { count: data.length };
      }),
    },
    investorPortalToken: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({})),
    },
    contact: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          contacts.find((c) => c.id === where.id) ?? null,
      ),
      update: vi.fn(async () => ({})),
    },
    $transaction: async (work: (tx: unknown) => unknown) => work(prisma),
    // Every lock read gets a row that answers both the share lock and the mint lock.
    $queryRaw: vi.fn(async () =>
      contacts.map((c) => ({
        id: c.id,
        kind: c.kind ?? "investor",
        portalBlockedAt: c.portalBlockedAt ?? null,
        email: c.email ?? null,
      })),
    ),
  } as unknown as PrismaClient;
  const deps = {
    prisma,
    env: { webOrigin: "http://127.0.0.1:5173" },
    dataDir: "/tmp/rakazo-router-test",
    email: { send },
  } as unknown as RouterDeps;
  const client = createRouterClient(createRouter(deps), { context: { actor } });
  return { client, send, created };
}

describe("investors.share", () => {
  const file = (id: string) => ({ id, name: `${id}.pdf` });
  const ada = { id: "c-ada", name: "Ada", email: "ada@example.test", kind: "investor" };

  it("shares a batch of files with one email per investor listing them", async () => {
    const { client, send, created } = setupShare({
      items: [file("i1"), file("i2")],
      contacts: [ada],
    });
    const result = await client.investors.share({
      itemIds: ["i1", "i2"],
      contactIds: ["c-ada"],
      emailLink: true,
    });
    expect(created.map((r) => r.dataRoomItemId).sort()).toEqual(["i1", "i2"]);
    expect(created.every((r) => r.contactId === "c-ada")).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe("ada@example.test");
    expect(send.mock.calls[0]?.[0].text).toContain("i1.pdf");
    expect(send.mock.calls[0]?.[0].text).toContain("i2.pdf");
    expect(result.items).toEqual([
      { itemId: "i1", shared: true },
      { itemId: "i2", shared: true },
    ]);
  });

  it("sends nothing to an investor who already has every listed file", async () => {
    const { client, send, created } = setupShare({
      items: [file("i1"), file("i2")],
      shares: [
        { contactId: "c-ada", dataRoomItemId: "i1" },
        { contactId: "c-ada", dataRoomItemId: "i2" },
      ],
      contacts: [ada],
    });
    const result = await client.investors.share({
      itemIds: ["i1", "i2"],
      contactIds: ["c-ada"],
      emailLink: true,
    });
    expect(created).toEqual([]);
    expect(send).not.toHaveBeenCalled();
    expect(result.items?.every((i) => i.shared)).toBe(true);
  });

  it("refuses a file it cannot share without failing the rest", async () => {
    const { client, created } = setupShare({ items: [file("i1")], contacts: [ada] });
    const result = await client.investors.share({
      itemIds: ["i1", "i-foreign"],
      contactIds: ["c-ada"],
      emailLink: false,
    });
    expect(result.items).toEqual([
      { itemId: "i1", shared: true },
      { itemId: "i-foreign", shared: false },
    ]);
    expect(created.map((r) => r.dataRoomItemId)).toEqual(["i1"]);
  });

  it("keeps the single-item form refusing a document it cannot find", async () => {
    const { client } = setupShare({ contacts: [ada] });
    await expect(
      client.investors.share({ itemId: "gone", contactIds: ["c-ada"], emailLink: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("the single-item form still shares and emails one link", async () => {
    const { client, send, created } = setupShare({ items: [file("i1")], contacts: [ada] });
    await client.investors.share({ itemId: "i1", contactIds: ["c-ada"], emailLink: true });
    expect(created.map((r) => r.dataRoomItemId)).toEqual(["i1"]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].text).toContain("#");
  });
});
