import { describe, expect, it, vi } from "vitest";
import { createZernioQueueAdapter, parseZernioAccountsListResult } from "./gtm-queue.js";

const from = "2030-01-01T00:00:00Z";
const to = "2030-02-01T00:00:00Z";
const scope = { apiKey: "synthetic-api-key", from, to };

const post = (id: string, overrides: Record<string, unknown> = {}) => ({
  _id: id,
  content: "Scheduled text",
  status: "scheduled",
  scheduledFor: "2030-01-15T10:00:00Z",
  platforms: [
    {
      platform: "twitter",
      accountId: { _id: "account-1", platform: "twitter", username: "@acme" },
      status: "pending",
      ...("platformPostUrl" in overrides ? { platformPostUrl: overrides.platformPostUrl } : {}),
    },
  ],
  ...overrides,
});

const page = (pageNumber: number, posts: unknown[], total: number, pages: number) => ({
  posts,
  pagination: { page: pageNumber, limit: 100, total, pages },
});

const network = (fetch: typeof globalThis.fetch) => ({
  fetch,
  resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
});

// REST response examples: https://docs.zernio.com/posts/list-posts
describe("Zernio queue REST adapter", () => {
  it("reads a fixed-origin Bearer-authenticated paginated queue", async () => {
    const items = Array.from({ length: 101 }, (_, index) => post(`post-${index + 1}`));
    const fetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = new URL(String(input));
      const pageNumber = Number(url.searchParams.get("page"));
      return new Response(
        JSON.stringify(
          page(
            pageNumber,
            pageNumber === 1 ? items.slice(0, 100) : items.slice(100),
            items.length,
            2,
          ),
        ),
        { status: 200 },
      );
    });
    const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));

    const result = await adapter.listPosts(scope);
    expect(result).toMatchObject({
      status: "ready",
      complete: true,
    });
    expect(result.posts).toHaveLength(101);
    expect(result.posts[0]).toMatchObject({
      id: "post-1",
      content: "Scheduled text",
      platforms: [{ accountId: "account-1" }],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [urlValue, init] of fetch.mock.calls) {
      const url = new URL(String(urlValue));
      expect(url.origin + url.pathname).toBe("https://zernio.com/api/v1/posts");
      expect(url.searchParams.get("fromDate")).toBe(from);
      expect(url.searchParams.get("toDate")).toBe(to);
      expect(url.searchParams.get("sortBy")).toBe("scheduled-asc");
      expect(url.searchParams.get("limit")).toBe("100");
      expect(url.searchParams.get("fields")).toBe("content,status,scheduledFor,platforms");
      expect(init).toMatchObject({ method: "GET", redirect: "manual" });
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-api-key");
    }
    expect(new URL(String(fetch.mock.calls[1]?.[0])).searchParams.get("page")).toBe("2");
  });

  it("returns an incomplete ready result at the page cap", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const pageNumber = Number(new URL(String(input)).searchParams.get("page"));
      const posts = Array.from({ length: 100 }, (_, index) =>
        post(`post-${(pageNumber - 1) * 100 + index + 1}`),
      );
      return new Response(JSON.stringify(page(pageNumber, posts, 11_000, 110)), { status: 200 });
    });
    const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));

    const result = await adapter.listPosts(scope);
    expect(result).toMatchObject({
      status: "ready",
      complete: false,
    });
    expect(result.posts).toHaveLength(1_000);
    expect(result.posts[0]?.id).toBe("post-1");
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  it.each([0, 1])("accepts an empty queue with pagination.pages=%i", async (pages) => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify(page(1, [], 0, pages)), { status: 200 }),
    );
    const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));

    await expect(adapter.listPosts(scope)).resolves.toEqual({
      status: "ready",
      complete: true,
      posts: [],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retains only prior validated pages after a later request fails", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const pageNumber = Number(new URL(String(input)).searchParams.get("page"));
      if (pageNumber === 2) return new Response("provider detail must not escape", { status: 503 });
      const posts = Array.from({ length: 100 }, (_, index) => post(`post-${index + 1}`));
      return new Response(JSON.stringify(page(1, posts, 101, 2)), { status: 200 });
    });
    const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));

    const result = await adapter.listPosts(scope);
    expect(result).toMatchObject({
      status: "unavailable",
      complete: false,
    });
    expect(result.posts).toHaveLength(100);
    expect(result.posts[0]?.id).toBe("post-1");
    expect(result.posts[99]?.id).toBe("post-100");
  });

  it.each([undefined, null])(
    "rejects scheduled posts with date %s without losing prior pages",
    async (scheduledFor) => {
      for (const priorCount of [0, 100]) {
        const fetch = vi.fn(async (input: string | URL | Request) => {
          const pageNumber = Number(new URL(String(input)).searchParams.get("page"));
          const posts =
            priorCount > 0 && pageNumber === 1
              ? Array.from({ length: priorCount }, (_, index) => post(`post-${index + 1}`))
              : [post("missing-date", { scheduledFor })];
          return new Response(
            JSON.stringify(page(pageNumber, posts, priorCount + 1, priorCount ? 2 : 1)),
            { status: 200 },
          );
        });
        const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));
        const result = await adapter.listPosts(scope);
        expect(result).toMatchObject({ status: "unavailable", complete: false });
        expect(result.posts.map((item) => item.id)).toEqual(
          Array.from({ length: priorCount }, (_, index) => `post-${index + 1}`),
        );
      }
    },
  );

  it.each([undefined, null])(
    "skips legitimately unscheduled drafts with date %s",
    async (scheduledFor) => {
      const fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify(page(1, [post("draft", { status: "draft", scheduledFor })], 1, 1)),
            { status: 200 },
          ),
      );
      const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));
      await expect(adapter.listPosts(scope)).resolves.toEqual({
        status: "ready",
        complete: true,
        posts: [],
      });
    },
  );

  it("fails closed on malformed, inconsistent, duplicated or invalid queue data", async () => {
    for (const body of [
      page(1, [post("missing-count")], 2, 1),
      page(2, [post("post-1")], 1, 1),
      page(1, [post("same"), post("same")], 2, 1),
      page(1, [post("bad-date", { scheduledFor: "not-a-date" })], 1, 1),
      page(
        1,
        [
          post("bad-account", {
            platforms: [
              {
                platform: "twitter",
                accountId: { _id: "x", platform: "linkedin" },
                status: "pending",
              },
            ],
          }),
        ],
        1,
        1,
      ),
    ]) {
      const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
      const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));
      await expect(adapter.listPosts(scope)).resolves.toMatchObject({
        status: "unavailable",
        complete: false,
        posts: [],
      });
    }
  });

  it("filters to the half-open window and strips unsafe or nonpublished links", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            page(
              1,
              [
                post("start", { scheduledFor: from }),
                post("inside", { scheduledFor: "2030-01-15T10:00:00Z" }),
                post("end", { scheduledFor: to }),
                post("unsafe", {
                  status: "published",
                  platforms: [
                    {
                      platform: "twitter",
                      accountId: "account-1",
                      status: "published",
                      platformPostUrl: "javascript:alert(1)",
                    },
                  ],
                }),
                post("partial-public-link", {
                  status: "partial",
                  platforms: [
                    {
                      platform: "twitter",
                      accountId: "account-1",
                      status: "published",
                      platformPostUrl: "https://example.test/partial-target",
                    },
                  ],
                }),
                post("scheduled-link", { platformPostUrl: "https://example.test/post" }),
              ],
              6,
              1,
            ),
          ),
          { status: 200 },
        ),
    );
    const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));

    const result = await adapter.listPosts(scope);
    expect(result).toMatchObject({
      status: "ready",
      complete: true,
    });
    expect(result.posts.map((item) => item.id)).toEqual([
      "start",
      "inside",
      "unsafe",
      "partial-public-link",
      "scheduled-link",
    ]);
    expect(result.posts[2]?.platforms[0]).not.toHaveProperty("platformPostUrl");
    expect(result.posts[3]?.platforms[0]?.platformPostUrl).toBe(
      "https://example.test/partial-target",
    );
    expect(result.posts[4]?.platforms[0]).not.toHaveProperty("platformPostUrl");
  });

  it("does not request a REST queue without a bounded absolute window and key", async () => {
    const fetch = vi.fn(async () => new Response());
    const adapter = createZernioQueueAdapter(network(fetch as typeof globalThis.fetch));
    await expect(adapter.listPosts({ ...scope, apiKey: " " })).resolves.toMatchObject({
      status: "unavailable",
      complete: false,
      posts: [],
    });
    await expect(adapter.listPosts({ ...scope, from: "tomorrow" })).resolves.toMatchObject({
      status: "unavailable",
      complete: false,
      posts: [],
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Zernio accounts_list formatter", () => {
  // Formatter shape: https://github.com/zernio-dev/zernio-python/blob/4d64c3be370b260bc2e55ad81898e64d5ae50b87/src/late/mcp/server.py#L385-L399
  it("parses the documented string wrapper and raw formatter strictly", () => {
    const output = {
      accounts: [
        { id: "twitter-1", platform: "twitter", label: "@acme" },
        { id: "linkedin-1", platform: "linkedin", label: "Acme Corp" },
      ],
    };
    const formatted =
      "Found 2 connected account(s):\n\n- twitter: @acme (ID: twitter-1)\n- linkedin: Acme Corp (ID: linkedin-1)";
    expect(
      parseZernioAccountsListResult({
        content: [{ type: "text", text: JSON.stringify({ result: formatted }) }],
      }),
    ).toEqual(output.accounts);
    expect(
      parseZernioAccountsListResult({ structuredContent: { result: formatted }, content: [] }),
    ).toEqual(output.accounts);
    expect(
      parseZernioAccountsListResult({
        content: [
          { type: "text", text: "No accounts connected. Connect accounts at https://zernio.com" },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects count mismatches, duplicates, typed objects, and MCP errors", () => {
    for (const result of [
      {
        content: [
          { type: "text", text: "Found 2 connected account(s):\n\n- twitter: @a (ID: one)" },
        ],
      },
      {
        content: [
          {
            type: "text",
            text: "Found 2 connected account(s):\n\n- twitter: @a (ID: one)\n- twitter: @b (ID: one)",
          },
        ],
      },
      { structuredContent: { result: [{ id: "one", platform: "twitter" }] }, content: [] },
      { isError: true, content: [{ type: "text", text: "private provider error" }] },
    ]) {
      expect(parseZernioAccountsListResult(result)).toBeNull();
    }
  });

  it("rejects labels over the overview limit and oversized formatter text", () => {
    const label = `Found 1 connected account(s):\n\n- twitter: ${"a".repeat(301)} (ID: one)`;
    expect(parseZernioAccountsListResult({ content: [{ type: "text", text: label }] })).toBeNull();
    expect(
      parseZernioAccountsListResult({
        content: [{ type: "text", text: "a".repeat(1_000_001) }],
      }),
    ).toBeNull();
  });
});
