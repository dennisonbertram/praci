import { generateKeyPairSync } from "node:crypto";
import { EncryptedSecretStore, syncExchanges } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type FinanceDeps, financeOverview, financeRunway } from "./finance.js";
import {
  financeExchangeConnect,
  financeExchangeRemove,
  financeExchanges,
  syncExchangesQuietly,
} from "./finance-exchange.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const pem = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({
  type: "sec1",
  format: "pem",
}) as string;
const NOW = new Date("2026-10-15T12:00:00Z");

describePostgres("exchange connections (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `exch-${name}-${suffix}`;
  const spaceId = id("space");
  const userA = id("a");
  const userB = id("b");
  const actor = (userId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor(userA);
  const b = actor(userB);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let deps: FinanceDeps;
  let krakenResult: Record<string, string> = {};
  let krakenError: string[] = [];
  const requests: Array<{ method: string; url: string }> = [];

  const fakeFetch = (async (url: string, init?: RequestInit) => {
    requests.push({ method: init?.method ?? "GET", url });
    if (url.includes("key_permissions"))
      return json({ can_view: true, can_trade: false, can_transfer: false });
    if (url.includes("/brokerage/accounts"))
      return json({
        accounts: [
          { currency: "USD", available_balance: { value: "100.50" }, hold: { value: "0" } },
          { currency: "BTC", available_balance: { value: "0.01" }, hold: { value: "0" } },
          { currency: "ZZZ", available_balance: { value: "5" }, hold: { value: "0" } },
        ],
        has_next: false,
      });
    if (url.includes("/0/private/GetApiKeyInfo"))
      return json({ error: [], result: { permissions: ["query-funds", "query-ledger"] } });
    if (url.includes("/0/private/Balance"))
      return json({ error: krakenError, result: krakenResult });
    if (url.includes("coins.llama.fi"))
      return json({ coins: { "coingecko:bitcoin": { price: 50000, confidence: 0.99 } } });
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const userId of [userA, userB])
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: id("org"), name: id("org"), slug: id("org"), createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: id("org"), name: "General", isDefault: true },
    });
    deps = {
      prisma,
      jobs: { enqueue: async () => undefined },
      repos: createRepos(prisma),
      secrets: new EncryptedSecretStore("test-only-encryption-key"),
      exchangeFetch: fakeFetch,
      now: () => NOW,
    } as unknown as FinanceDeps;
  });
  afterAll(async () => {
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await close();
  });

  it("connects Coinbase, values balances, and never returns the key", async () => {
    const out = await financeExchangeConnect(deps, a, {
      provider: "coinbase",
      key: "organizations/o/apiKeys/k",
      secret: pem,
    });
    expect(out.connected).toBe(true);
    // 100.50 USD at 1 + 0.01 BTC at 50000 = 10050 + 50000 cents; ZZZ is unpriced.
    expect(out.totalCents).toBe(60_050);
    expect(out.balances.map((x) => [x.asset, x.usdValueCents])).toEqual([
      ["BTC", 50_000],
      ["USD", 10_050],
      ["ZZZ", null],
    ]);
    const text = JSON.stringify(await financeExchanges(deps, a));
    expect(text).not.toContain("organizations/o/apiKeys/k");
    expect(text).not.toContain("PRIVATE KEY");
    expect(text).not.toContain("secretId");
    expect(requests.every((r) => r.method === "GET")).toBe(true);
  });

  it("counts exchange cash in the overview and runway through the saved scope", async () => {
    const overview = await financeOverview(deps, a);
    expect(overview.crypto).toMatchObject({ totalCents: 60_050, stablecoinCents: 10_050 });
    expect(overview.cash.cashCents).toBe(0); // default scope: bank only, no bank accounts here
    await prisma.financePreference.create({
      data: { spaceId, userId: userA, runwayCrypto: "stablecoins" },
    });
    expect((await financeOverview(deps, a)).cash.cashCents).toBe(10_050);
    await prisma.financePreference.update({
      where: { spaceId_userId: { spaceId, userId: userA } },
      data: { runwayCrypto: "all" },
    });
    expect((await financeRunway(deps, a)).cashCents).toBe(60_050);
  });

  it("writes one snapshot per connection and day", async () => {
    await syncExchangesQuietly(deps, a);
    const snaps = await prisma.financeExchangeSnapshot.findMany({
      where: { spaceId, userId: userA },
    });
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({
      day: "2026-10-15",
      stablecoinCents: 10_050n,
      otherCryptoCents: 50_000n,
    });
  });

  it("isolates tenants: another user sees nothing and cannot remove it", async () => {
    expect(await financeExchanges(deps, b)).toEqual([]);
    expect(await financeOverview(deps, b).then((o) => o.crypto ?? null)).toBeNull();
    const [mine] = await financeExchanges(deps, a);
    await expect(financeExchangeRemove(deps, b, { id: mine?.id ?? "" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await financeExchanges(deps, a)).toHaveLength(1);
  });

  it("folds Kraken suffixes and rejects a bad key without storing anything", async () => {
    krakenResult = { XXBT: "0.5", "XBT.F": "0.5", ZUSD: "10" };
    krakenError = ["EGeneral:Permission denied"];
    const input = {
      provider: "kraken" as const,
      key: "kk",
      secret: Buffer.from("s").toString("base64"),
    };
    await expect(financeExchangeConnect(deps, a, input)).rejects.toMatchObject({
      message: "This key can't read balances",
    });
    expect(
      await prisma.financeExchangeConnection.count({ where: { spaceId, provider: "kraken" } }),
    ).toBe(0);
    krakenError = [];
    const out = await financeExchangeConnect(deps, a, input);
    expect(out.balances.map((x) => [x.asset, x.amount])).toEqual([
      ["BTC", "1.0"],
      ["USD", "10"],
    ]);
  });

  it("keeps old balances and records the reason when a later sync fails", async () => {
    krakenError = ["EAPI:Rate limit exceeded"];
    await syncExchangesQuietly(deps, a);
    const kraken = (await financeExchanges(deps, a)).find((x) => x.provider === "kraken");
    expect(kraken?.lastError).toBe("Kraken rate limit reached, try again shortly");
    expect(kraken?.balances).toHaveLength(2);
  });

  it("drops a stalled sync of the old key when the account was reconnected meanwhile", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stalled = (async (url: string, init?: RequestInit) => {
      if (url.includes("/0/private/Balance")) {
        await gate;
        return json({ error: [], result: { ZUSD: "999" } });
      }
      return fakeFetch(url, init);
    }) as unknown as typeof fetch;
    krakenError = [];
    krakenResult = { ZUSD: "7" };
    const syncing = syncExchanges(
      { prisma, secrets: deps.secrets, fetch: stalled, now: () => NOW },
      { spaceId, userId: userA },
      { force: true },
    );
    await new Promise((r) => setTimeout(r, 200));
    await financeExchangeConnect(deps, a, {
      provider: "kraken",
      key: "new-key",
      secret: Buffer.from("s2").toString("base64"),
    });
    release();
    await syncing;
    const kraken = (await financeExchanges(deps, a)).find((x) => x.provider === "kraken");
    expect(kraken?.balances.map((x) => [x.asset, x.amount])).toEqual([["USD", "7"]]);
    expect(kraken?.lastError).toBeNull();
  });

  it("removes the connection, its balances and its stored key", async () => {
    const before = await prisma.secret.count({
      where: { spaceId, userId: userA, kind: "exchange" },
    });
    expect(before).toBe(2);
    for (const x of await financeExchanges(deps, a))
      await financeExchangeRemove(deps, a, { id: x.id });
    expect(await financeExchanges(deps, a)).toEqual([]);
    expect(await prisma.secret.count({ where: { spaceId, userId: userA, kind: "exchange" } })).toBe(
      0,
    );
    expect(await prisma.financeExchangeBalance.count({ where: { spaceId } })).toBe(0);
  });
});
