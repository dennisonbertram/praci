import type { Actor } from "@rakazo/contracts";
import { getLogger } from "@rakazo/logging";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { mountEmailImageProxy, proxyEmailImages, signedImageUrl } from "./email-image-proxy.js";

const SECRET = "test-secret-test-secret-test-secret";
const user1 = { userId: "user-1", spaceId: "space-1" };
const actorOf = (s: { userId: string; spaceId: string }): Actor => ({
  ...s,
  email: "x@example.test",
  isDeploymentOwner: false,
});
const PNG = new Uint8Array([137, 80, 78, 71]);

type Upstream = (url: string) => Response;
function setup(
  upstream: Upstream,
  session: Actor | null = actorOf(user1),
  resolved = "93.184.216.34",
) {
  const calls: string[] = [];
  const app = new Hono();
  mountEmailImageProxy(
    app,
    {
      secret: SECRET,
      now,
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(String(input));
        expect(new Headers(init?.headers).get("cookie")).toBeNull();
        expect(new Headers(init?.headers).get("referer")).toBeNull();
        return upstream(String(input));
      }) as typeof fetch,
      resolveHostname: async (host) =>
        host === "internal.example.test"
          ? [{ address: "10.0.0.5", family: 4 }]
          : [{ address: resolved, family: 4 }],
    },
    async () => session,
  );
  return { app, calls };
}
const image = (type = "image/png", body: BodyInit = PNG) =>
  new Response(body, { headers: { "content-type": type } });
const get = (app: Hono, url: string, scope = user1) =>
  app.request(signedImageUrl(SECRET, url, scope));

describe("email image proxy", () => {
  it("serves an allowed image with safe headers and sends no cookie or referrer", async () => {
    const { app, calls } = setup(() => image());
    const res = await get(app, "https://img.example.test/a.png?id=secret-token");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(calls).toEqual(["https://img.example.test/a.png?id=secret-token"]);
  });

  it("rejects a tampered target, another user and another space", async () => {
    const { app, calls } = setup(() => image());
    const url = signedImageUrl(SECRET, "https://img.example.test/a.png", user1);
    expect((await app.request(url.replace("a.png", "b.png"))).status).toBe(403);
    const other = setup(() => image(), actorOf({ userId: "user-2", spaceId: "space-1" }));
    expect((await other.app.request(url)).status).toBe(403);
    const space = setup(() => image(), actorOf({ userId: "user-1", spaceId: "space-2" }));
    expect((await space.app.request(url)).status).toBe(403);
    expect((await app.request(`${url}&t=x`.replace(/t=[^&]+&t=/, "t="))).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("rejects private targets, redirects to them, and names that resolve to them", async () => {
    const warn = vi.spyOn(getLogger(), "warn").mockImplementation(() => undefined);
    const { app, calls } = setup((url) =>
      url.includes("redirect")
        ? new Response(null, { status: 302, headers: { location: "http://169.254.169.254/x.png" } })
        : image(),
    );
    expect((await get(app, "http://127.0.0.1/a.png")).status).toBe(502);
    expect((await get(app, "https://internal.example.test/a.png")).status).toBe(502);
    expect((await get(app, "https://img.example.test/redirect.png")).status).toBe(502);
    expect((await get(app, "ftp://img.example.test/a.png")).status).toBe(502);
    expect(calls).toEqual(["https://img.example.test/redirect.png"]);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("redirect.png");
    warn.mockRestore();
  });

  it("allows at most 3 redirect hops", async () => {
    const { app, calls } = setup((url) => {
      const n = Number(/hop(\d)/.exec(url)?.[1] ?? 0);
      return new Response(null, {
        status: 302,
        headers: { location: `https://img.example.test/hop${n + 1}` },
      });
    });
    expect((await get(app, "https://img.example.test/hop0")).status).toBe(502);
    expect(calls).toHaveLength(4);
  });

  it("refuses SVG, other types and oversized bodies", async () => {
    expect(
      (
        await get(
          setup(() => image("image/svg+xml", "<svg/>")).app,
          "https://img.example.test/a.svg",
        )
      ).status,
    ).toBe(415);
    expect(
      (await get(setup(() => image("text/html", "<script>")).app, "https://img.example.test/a"))
        .status,
    ).toBe(415);
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    expect(
      (await get(setup(() => image("image/png", big)).app, "https://img.example.test/big.png"))
        .status,
    ).toBe(502);
  });
});

describe("email image proxy expiry", () => {
  it("rejects an expired link and a link whose expiry was edited", async () => {
    const { app, calls } = setup(
      () => image(),
      actorOf(user1),
      undefined,
      () => 1_000_000,
    );
    const url = "https://img.example.test/a.png";
    expect((await app.request(signedImageUrl(SECRET, url, user1, 1_000_001))).status).toBe(200);
    expect((await app.request(signedImageUrl(SECRET, url, user1, 1_000_000))).status).toBe(403);
    const edited = signedImageUrl(SECRET, url, user1, 1_000_001).replace("e=1000001", "e=9999999");
    expect((await app.request(edited)).status).toBe(403);
    expect(calls).toHaveLength(1);
  });

  it("issues a link that lasts 24 hours", () => {
    const link = signedImageUrl(SECRET, "https://a.test/x.png", user1);
    const exp = Number(new URL(link, "http://x").searchParams.get("e"));
    expect(exp - Date.now()).toBeGreaterThan(23.9 * 3600_000);
    expect(exp - Date.now()).toBeLessThanOrEqual(24 * 3600_000);
  });
});

describe("proxyEmailImages", () => {
  it("rewrites http(s) src, drops srcset, and leaves data and cid images", () => {
    const html =
      '<img src="https://a.example.test/x.png?a=1&amp;b=2" srcset="https://a.example.test/x2.png 2x" alt="x">' +
      '<img src=\'http://a.example.test/y.png\'><img src="data:image/png;base64,AA"><img src="cid:logo">';
    const out = proxyEmailImages(html, SECRET, user1);
    expect(out).not.toContain("srcset");
    expect(out).not.toContain("https://a.example.test");
    expect(out.match(/src="\/api\/inbox\/image\?/g)).toHaveLength(2);
    expect(out).toContain('src="data:image/png;base64,AA"');
    expect(out).toContain('src="cid:logo"');
    const first = /src="([^"]+)"/.exec(out)?.[1]?.replace(/&amp;/g, "&") ?? "";
    expect(new URL(first, "http://x").searchParams.get("u")).toBe(
      "https://a.example.test/x.png?a=1&b=2",
    );
  });
});
