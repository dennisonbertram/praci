import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Only the address policy is relaxed, and only here: the test server listens on loopback. The
// resolver, the lookup shape and the undici transport are the real ones.
vi.mock("./network-address.js", async (original) => {
  const real = await original<typeof import("./network-address.js")>();
  return {
    ...real,
    isPrivateAddress: (address: string) =>
      address === "127.0.0.1" ? false : real.isPrivateAddress(address),
  };
});

const { runHttpSource, errorChain } = await import("./page-source-http.js");

const seen: { method?: string; auth?: string; url?: string }[] = [];
const server = createServer((request, response) => {
  seen.push({ method: request.method, auth: request.headers.authorization, url: request.url });
  if (request.url === "/moved") {
    response.writeHead(301, { location: "http://127.0.0.1:1/elsewhere" }).end();
  } else if (request.url === "/down") {
    response.writeHead(503).end("secret stack trace");
  } else if (request.url === "/csv") {
    response.writeHead(200, { "content-type": "text/csv" }).end("a,b\n1,x\n");
  } else {
    response.writeHead(200, { "content-type": "application/json" }).end('{"ok":1}');
  }
});
let base = "";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const scope = { spaceId: "sp", botId: "bot", userId: "owner" };
const go = (
  path: string,
  extra: Record<string, unknown> = {},
  deps: Record<string, unknown> = {},
) =>
  runHttpSource(
    { prisma: {} as PrismaClient, ...deps },
    scope,
    { url: `${base}${path}`, accept: "json", ...extra } as never,
    async () => {},
  );

describe("http source over the real transport", () => {
  it("fetches JSON and CSV with GET through the real resolver and lookup", async () => {
    seen.length = 0;
    expect(await go("/data")).toEqual({ ok: 1 });
    expect(await go("/csv", { accept: "csv" })).toEqual([{ a: 1, b: "x" }]);
    expect(seen.map((entry) => entry.method)).toEqual(["GET", "GET"]);
  });

  it("maps a redirect and an error status to the fixed messages", async () => {
    await expect(go("/moved")).rejects.toThrow("The API redirected; update the source URL.");
    await expect(go("/down")).rejects.toThrow("The API returned 503.");
  });

  it("keeps the underlying error for the log, without the response body", async () => {
    const error = await go("/down").catch((caught: unknown) => caught);
    expect(errorChain(error)).toContain("HTTP 503");
    expect(errorChain(error)).not.toContain("secret stack trace");
    const refused = await go("/data", {}, { network: { resolveHostname: async () => [] } }).catch(
      (caught: unknown) => caught,
    );
    expect((refused as Error).message).toBe("The URL targets a private or internal host.");
  });
});
