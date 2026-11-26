import { BrexApiEmulator } from "@rakazo/brex-mcp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectBrexCardsSession } from "./brex-cards-binding.js";
import { McpSession } from "./mcp-transport.js";

const TOKEN = "bxt_unit_token_1234567890";
const SERVER = { id: "server-1", spaceId: "space-1", userId: "user-1" };
const CREATE = {
  cardName: "Notion",
  ownerUserId: "u_ada",
  ownerName: "Ada Example",
  amountCents: 25_000,
  duration: "MONTHLY",
};

type Reservation = {
  id: string;
  spaceId: string;
  brexAccountId: string;
  status: string;
  brexCardId?: string | null;
};
type ConnectionRow = {
  serverId: string;
  spaceId: string;
  brexAccountId: string;
  maxNewCardLimitCents: number;
  maxCardLimitCents: number;
  maxSpendLimitBaseCents: number;
  maxCardsPerDay: number;
  allowedDurations: string[];
  oneTimeMaxDays: number | null;
};

const row = (over: Partial<ConnectionRow> = {}): ConnectionRow => ({
  serverId: SERVER.id,
  spaceId: SERVER.spaceId,
  brexAccountId: "cmp_example",
  maxNewCardLimitCents: 100_000,
  maxCardLimitCents: 500_000,
  maxSpendLimitBaseCents: 1_000_000,
  maxCardsPerDay: 5,
  allowedDurations: ["MONTHLY", "ONE_TIME"],
  oneTimeMaxDays: 90,
  ...over,
});

/** Only the calls the binding makes: the real queries are covered by the Postgres suite. */
function fakePrisma(connection: ConnectionRow | null) {
  const state = { connection, reservations: [] as Reservation[] };
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    brexCardReservation: {
      count: vi.fn(
        async ({ where }: { where: { brexAccountId: string; status: { not: string } } }) =>
          state.reservations.filter(
            (r) => r.brexAccountId === where.brexAccountId && r.status !== where.status.not,
          ).length,
      ),
      create: vi.fn(async ({ data }: { data: Omit<Reservation, "id"> }) => {
        const created = { id: `res-${state.reservations.length + 1}`, ...data };
        state.reservations.push(created);
        return created;
      }),
    },
  };
  const prisma = {
    brexCardsConnection: { findFirst: vi.fn(async () => state.connection) },
    brexCardReservation: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; spaceId: string };
          data: Partial<Reservation>;
        }) => {
          const found = state.reservations.find(
            (r) => r.id === where.id && r.spaceId === where.spaceId,
          );
          if (found) Object.assign(found, data);
          return { count: found ? 1 : 0 };
        },
      ),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return { prisma, state };
}

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
});

async function setup(connection: ConnectionRow | null = row()) {
  const emulator = new BrexApiEmulator({ token: TOKEN });
  const baseUrl = await emulator.start();
  const { prisma, state } = fakePrisma(connection);
  const session = new McpSession({ name: "brex-binding-test" });
  await connectBrexCardsSession(session, {
    server: SERVER,
    token: TOKEN,
    prisma: prisma as never,
    baseUrl,
  });
  cleanup.push(async () => {
    await session.close();
    await emulator.stop();
  });
  const call = async (name: string, args: Record<string, unknown>, key?: string) => {
    const result = await session.callTool(name, args, key ? { meta: { idempotencyKey: key } } : {});
    const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
    return { isError: result.isError === true, text };
  };
  const posts = () =>
    emulator.requests.filter((r) => r.method === "POST" && r.path === "/v2/cards");
  return { emulator, session, state, prisma, call, posts };
}

describe("Brex cards binding", () => {
  it("serves the Brex tools in process and sends the secret's token as the bearer token", async () => {
    const { session, call, emulator } = await setup();
    const names = (await session.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["list_cards", "create_vendor_card"]));
    expect(names).not.toContain("unlock_card");

    const result = await call("list_cards", {});
    expect(result.isError).toBe(false);
    expect(emulator.requests[0]?.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("reads the owner's controls inside each write, so a change between calls applies", async () => {
    const { call, state, posts } = await setup();
    expect((await call("create_vendor_card", CREATE, "effect-1")).isError).toBe(false);

    state.connection = row({ maxNewCardLimitCents: 10_000 });
    const refused = await call("create_vendor_card", { ...CREATE, cardName: "Linear" }, "effect-2");
    expect(refused.isError).toBe(true);
    expect(posts()).toHaveLength(1);
  });

  it.each([
    ["another space's", () => row({ spaceId: "space-2" })],
    ["no", () => null],
  ])(
    "refuses a write when it finds %s connection row, before any Brex request",
    async (_label, make) => {
      const { call, emulator } = await setup(make());
      const result = await call("create_vendor_card", CREATE, "effect-1");
      expect(result.isError).toBe(true);
      expect(emulator.requests.filter((r) => r.method !== "GET")).toEqual([]);
    },
  );

  it("sends the call's idempotency key to Brex: a retry reuses it, another approval does not", async () => {
    const { call, emulator, posts } = await setup();
    const before = emulator.cards.length;

    const first = await call("create_vendor_card", CREATE, "effect-1");
    const retry = await call("create_vendor_card", CREATE, "effect-1");
    expect(first.text).toBe(retry.text);
    expect(emulator.cards.length).toBe(before + 1);

    await call("create_vendor_card", CREATE, "effect-2");
    expect(emulator.cards.length).toBe(before + 2);
    expect(posts().map((request) => request.idempotencyKey)).toEqual([
      "effect-1",
      "effect-1",
      "effect-2",
    ]);
  });

  it("refuses a change that arrives without an idempotency key, before any Brex write", async () => {
    const { call, emulator, state } = await setup();
    const result = await call("create_vendor_card", CREATE);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/idempotency key/);
    expect(emulator.requests.filter((r) => r.method !== "GET")).toEqual([]);
    expect(state.reservations).toEqual([]);
  });

  it("reserves a card for the connection's Brex account and settles it with the card id", async () => {
    const { call, state } = await setup();
    const result = await call("create_vendor_card", CREATE, "effect-1");
    const cardId = (JSON.parse(result.text) as { id: string }).id;
    expect(state.reservations).toMatchObject([
      {
        id: "res-1",
        spaceId: SERVER.spaceId,
        brexAccountId: "cmp_example",
        status: "created",
        brexCardId: cardId,
      },
    ]);
  });

  it("refuses at the daily cap without a Brex write", async () => {
    const { call, posts, state } = await setup(row({ maxCardsPerDay: 1 }));
    expect((await call("create_vendor_card", CREATE, "effect-1")).isError).toBe(false);
    const second = await call("create_vendor_card", { ...CREATE, cardName: "Linear" }, "effect-2");
    expect(second.isError).toBe(true);
    expect(posts()).toHaveLength(1);
    expect(state.reservations).toHaveLength(1);
  });
});
