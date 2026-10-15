import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  coinbaseJwt,
  EXCHANGE_ALLOWED_REQUESTS,
  ExchangeError,
  fetchCoinbaseBalances,
  fetchKrakenBalances,
  krakenSignature,
} from "./exchange-clients.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const NOW = new Date("2026-10-15T12:00:00Z");
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "sec1", format: "pem" }) as string;
const coinbaseCreds = { key: "organizations/org-1/apiKeys/key-1", secret: pem };

describe("Kraken signing", () => {
  it("matches the documented test vector", () => {
    const sig = krakenSignature(
      "kQH5HW/8p1uGOVjbgWA7FunAmGO8lsSUXNsu3eow76sz84Q18fWxnyRzBHCd3pd5nE9qa99HAZtuZuj6F1huXg==",
      "/0/private/AddOrder",
      "1616492376594",
      "nonce=1616492376594&ordertype=limit&pair=XBTUSD&price=37500&type=buy&volume=1.25",
    );
    expect(sig).toBe(
      "4/dpxb3iT4tp/ZCVEwSnEsLxx0bqyhLpdfOpc6fn7OR8+UClSV5n9E6aSS8MPtnRfp32bAb0nmbRn6H8ndwLUQ==",
    );
  });
});

describe("Kraken balances", () => {
  const creds = { key: "fake-key", secret: Buffer.from("fake-secret").toString("base64") };
  it("posts only to the Balance path with a signed body and returns raw codes, suffixes included", async () => {
    const fetchMock = vi.fn(async () =>
      json({ error: [], result: { XXBT: "0.5", "XBT.F": "0.1", ZUSD: "12.34", "DOT.S": "3" } }),
    );
    const out = await fetchKrakenBalances(creds, { fetch: fetchMock as never, now: () => NOW });
    expect(out.map((b) => [b.code, b.amount])).toEqual([
      ["XXBT", "0.5"],
      ["XBT.F", "0.1"],
      ["ZUSD", "12.34"],
      ["DOT.S", "3"],
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.kraken.com/0/private/Balance");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["API-Key"]).toBe("fake-key");
    expect(headers["API-Sign"]).toBe(
      krakenSignature(
        creds.secret,
        "/0/private/Balance",
        String(NOW.getTime()),
        init.body as string,
      ),
    );
  });

  it.each([
    [["EGeneral:Permission denied"], "This key can't read balances"],
    [["EAPI:Invalid key"], "Kraken did not accept this key"],
    [["EAPI:Rate limit exceeded"], "Kraken rate limit reached, try again shortly"],
    [["EService:Unavailable"], "Kraken is not responding"],
  ])("maps %j to a plain message", async (error, message) => {
    const fetchMock = vi.fn(async () => json({ error }));
    await expect(
      fetchKrakenBalances(creds, { fetch: fetchMock as never, now: () => NOW }),
    ).rejects.toThrow(message);
  });

  it("maps HTTP 5xx and network failure to unavailable, and a non-base64 secret to an invalid key", async () => {
    await expect(
      fetchKrakenBalances(creds, { fetch: (async () => json({}, 503)) as never }),
    ).rejects.toMatchObject({ kind: "unavailable" });
    await expect(
      fetchKrakenBalances(creds, {
        fetch: (async () => {
          throw new Error("boom");
        }) as never,
      }),
    ).rejects.toMatchObject({ kind: "unavailable" });
    await expect(fetchKrakenBalances({ key: "k", secret: "not base64!" })).rejects.toMatchObject({
      kind: "invalid_key",
    });
  });
});

describe("Coinbase JWT", () => {
  it("has the CDP header and claims and a signature the public key verifies", () => {
    const jwt = coinbaseJwt(
      coinbaseCreds,
      "GET",
      "api.coinbase.com",
      "/api/v3/brokerage/accounts",
      1_000,
      "n1",
    );
    const [h, p, s] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: coinbaseCreds.key,
      nonce: "n1",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toEqual({
      sub: coinbaseCreds.key,
      iss: "cdp",
      nbf: 1_000,
      exp: 1_120,
      uri: "GET api.coinbase.com/api/v3/brokerage/accounts",
    });
    expect(
      createVerify("SHA256")
        .update(`${h}.${p}`)
        .verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")),
    ).toBe(true);
  });

  it("accepts a key whose newlines were dropped by a single-line input", () => {
    const flat = pem.trim().replace(/\n/g, "");
    expect(() =>
      coinbaseJwt({ ...coinbaseCreds, secret: flat }, "GET", "h", "/p", 1),
    ).not.toThrow();
  });

  it("accepts a key pasted on one line with literal \\n", () => {
    const oneLine = pem.trim().replace(/\n/g, "\\n");
    expect(() =>
      coinbaseJwt({ ...coinbaseCreds, secret: oneLine }, "GET", "h", "/p", 1),
    ).not.toThrow();
  });
});

describe("Coinbase balances", () => {
  const viewOnly = { can_view: true, can_trade: false, can_transfer: false };
  const account = (currency: string, available: string, hold = "0") => ({
    currency,
    available_balance: { value: available, currency },
    hold: { value: hold, currency },
  });
  const router = (perms: unknown, pages: unknown[]) => {
    let page = 0;
    return vi.fn(async (url: string) => {
      if (url.includes("key_permissions")) return json(perms);
      return json(pages[page++]);
    });
  };

  it("checks permissions, follows the cursor and adds hold to available", async () => {
    const fetchMock = router(viewOnly, [
      { accounts: [account("BTC", "0.5", "0.25")], has_next: true, cursor: "c2" },
      { accounts: [account("USD", "100")], has_next: false },
    ]);
    const out = await fetchCoinbaseBalances(coinbaseCreds, {
      fetch: fetchMock as never,
      now: () => NOW,
    });
    expect(out.map((b) => [b.code, b.amount])).toEqual([
      ["BTC", "0.5"],
      ["BTC", "0.25"],
      ["USD", "100"],
      ["USD", "0"],
    ]);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls[0]).toBe("https://api.coinbase.com/api/v3/brokerage/key_permissions");
    expect(urls[2]).toContain("cursor=c2");
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer ey/);
  });

  it("calls only allowed paths and never a write method", async () => {
    const fetchMock = router(viewOnly, [{ accounts: [], has_next: false }]);
    await fetchCoinbaseBalances(coinbaseCreds, { fetch: fetchMock as never });
    for (const [url, init] of fetchMock.mock.calls as unknown as Array<[string, RequestInit]>) {
      const u = new URL(url);
      expect(EXCHANGE_ALLOWED_REQUESTS).toContain(`${init.method} ${u.host}${u.pathname}`);
    }
  });

  it("rejects a key that can trade or transfer, before reading accounts", async () => {
    for (const perms of [
      { can_view: true, can_trade: true, can_transfer: false },
      { can_view: true, can_trade: false, can_transfer: true },
    ]) {
      const fetchMock = router(perms, []);
      await expect(
        fetchCoinbaseBalances(coinbaseCreds, { fetch: fetchMock as never }),
      ).rejects.toThrow("This key can trade or transfer. Create a view-only key");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("maps 401, 403 and 429, and a bad private key", async () => {
    const status = (code: number) => (async () => json({}, code)) as never;
    await expect(
      fetchCoinbaseBalances(coinbaseCreds, { fetch: status(401) }),
    ).rejects.toMatchObject({ kind: "invalid_key" });
    await expect(
      fetchCoinbaseBalances(coinbaseCreds, { fetch: status(403) }),
    ).rejects.toMatchObject({ kind: "missing_permission" });
    await expect(
      fetchCoinbaseBalances(coinbaseCreds, { fetch: status(429) }),
    ).rejects.toMatchObject({ kind: "rate_limit" });
    await expect(
      fetchCoinbaseBalances({ key: "k", secret: "nope" }, { fetch: status(200) }),
    ).rejects.toBeInstanceOf(ExchangeError);
  });
});
