import { describe, expect, it, vi } from "vitest";
import type { BoxFilesDeps } from "./box-files.js";
import { BoxFileError, boxAccessToken, listBoxFiles } from "./box-files.js";

const account = { id: "s1", name: "Box", endpoint: "https://mcp.box.com", secretId: "sec1" };
const scope = { spaceId: "sp", userId: "u", signal: new AbortController().signal };
const prisma = { mcpServer: { findMany: vi.fn(async () => [account]) } };
const empty = () => new Response(JSON.stringify({ entries: [] }), { status: 200 });
const unauthorized = () => new Response("{}", { status: 401 });

function deps(overrides: Partial<BoxFilesDeps>): BoxFilesDeps {
  return { prisma: prisma as never, accessToken: async () => "tok", ...overrides };
}

describe("Box file access", () => {
  it("renews the token after a 401 and retries the request once", async () => {
    const tokens = vi.fn(async (_a: unknown, _s: unknown, o?: { rejected?: string }) =>
      o?.rejected ? "fresh" : "stale",
    );
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) =>
      new Headers(init?.headers).get("authorization") === "Bearer fresh" ? empty() : unauthorized(),
    );
    await expect(
      listBoxFiles(deps({ accessToken: tokens, fetch: fetchMock as never }), scope),
    ).resolves.toEqual({ files: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokens).toHaveBeenLastCalledWith(account, expect.anything(), { rejected: "stale" });
  });

  it("asks to reconnect when the renewal fails", async () => {
    const fetchMock = vi.fn(async () => unauthorized());
    const accessToken = vi.fn(async (_a: unknown, _s: unknown, o?: { rejected?: string }) =>
      o?.rejected ? null : "stale",
    );
    await expect(
      listBoxFiles(deps({ accessToken, fetch: fetchMock as never }), scope),
    ).rejects.toMatchObject({ code: "reconnect" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renews only once when the new token is refused too", async () => {
    const fetchMock = vi.fn(async () => unauthorized());
    const accessToken = vi.fn(async (_a: unknown, _s: unknown, o?: { rejected?: string }) =>
      o?.rejected ? "fresh" : "stale",
    );
    const result = listBoxFiles(deps({ accessToken, fetch: fetchMock as never }), scope);
    await expect(result).rejects.toBeInstanceOf(BoxFileError);
    await expect(result).rejects.toMatchObject({ code: "reconnect" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(accessToken).toHaveBeenCalledTimes(2);
  });

  it("boxAccessToken renews a rejected token and returns the stored one otherwise", async () => {
    const renew = vi.fn(async () => undefined);
    const tokens = vi.fn(async () => ({ access_token: "a", token_type: "Bearer" }));
    const read = boxAccessToken({ providerFor: async () => ({ renew, tokens }) as never });
    await expect(read(account, scope)).resolves.toBe("a");
    expect(renew).not.toHaveBeenCalled();
    await expect(read(account, scope, { rejected: "old" })).resolves.toBe("a");
    expect(renew).toHaveBeenCalledWith("old");
  });
});
