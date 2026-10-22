import { GtmPostInputSchema, gtmAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { ZernioCreateInput, ZernioCreateResult } from "./gtm-posting.js";
import {
  createZernioRestAdapter,
  executeApprovedGtmPost,
  parseZernioCreateResponse,
  resolveZernioApiKey,
} from "./gtm-posting.js";

const input: ZernioCreateInput = {
  content: "Approved post",
  scheduledFor: "2030-01-02T03:04:05.000Z",
  platform: "twitter",
  accountId: "account-1",
};
const proofUrl = "https://x.example.test/status/123";
const scope = { runId: "run-1", spaceId: "space-1", userId: "user-1", botId: "bot-1" };
const effectKey = `run-1:gtm_post:${"a".repeat(64)}`;

const post = (overrides: Record<string, unknown> = {}) => ({
  _id: "post-1",
  content: input.content,
  scheduledFor: input.scheduledFor,
  platforms: [
    {
      platform: input.platform,
      accountId: input.accountId,
      status: "published",
      platformPostUrl: proofUrl,
    },
  ],
  ...overrides,
});

describe("Zernio REST adapter", () => {
  it("uses the strict approved-post input contract", () => {
    expect(
      GtmPostInputSchema.safeParse({
        content: input.content,
        scheduledFor: input.scheduledFor,
        accountId: input.accountId,
        platform: input.platform,
      }).success,
    ).toBe(false);
    expect(
      GtmPostInputSchema.safeParse({
        content: input.content,
        scheduledFor: "tomorrow",
        accountId: input.accountId,
      }).success,
    ).toBe(false);
  });

  it("sends the exact fixed POST with scoped Bearer auth and body", async () => {
    const fetch = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ post: post() }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );
    const adapter = createZernioRestAdapter({
      fetch,
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    });

    await expect(adapter.createPost({ apiKey: "offline-test-key", input })).resolves.toEqual({
      state: "completed",
      postId: "post-1",
      platformPostUrl: proofUrl,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://zernio.com/api/v1/posts");
    expect(init).toMatchObject({ method: "POST", redirect: "manual" });
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer offline-test-key");
    expect(headers.get("content-type")).toBe("application/json");
    const body =
      init?.body instanceof ArrayBuffer ? new TextDecoder().decode(init.body) : String(init?.body);
    expect(JSON.parse(body)).toEqual({
      content: input.content,
      scheduledFor: input.scheduledFor,
      platforms: [{ platform: input.platform, accountId: input.accountId }],
    });
  });

  it("rejects unknown overrides and an empty key before fetch", async () => {
    const fetch = vi.fn(async () => new Response());
    const adapter = createZernioRestAdapter({
      fetch,
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    });

    await expect(
      adapter.createPost({
        apiKey: "offline-test-key",
        input: { ...input, title: "override" } as never,
      }),
    ).resolves.toEqual({ state: "uncertain" });
    await expect(adapter.createPost({ apiKey: "   ", input })).resolves.toEqual({
      state: "uncertain",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not follow redirects or retry uncertain HTTP responses", async () => {
    const redirectFetch = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 302, headers: { location: "https://elsewhere.test/post" } }),
    );
    const adapter = createZernioRestAdapter({
      fetch: redirectFetch,
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    });
    await expect(adapter.createPost({ apiKey: "offline-test-key", input })).resolves.toEqual({
      state: "uncertain",
    });
    expect(redirectFetch).toHaveBeenCalledTimes(1);
    expect(redirectFetch.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });

    const serverError = createZernioRestAdapter({
      fetch: vi.fn(async () => new Response("{}", { status: 500 })),
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    });
    await expect(serverError.createPost({ apiKey: "offline-test-key", input })).resolves.toEqual({
      state: "uncertain",
    });
  });

  it("returns uncertain for an aborted transport and malformed success", async () => {
    const aborted = new AbortController();
    aborted.abort();
    const fetch = vi.fn(async () => new Response("{}", { status: 201 }));
    const adapter = createZernioRestAdapter({
      fetch,
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    });
    await expect(
      adapter.createPost({ apiKey: "offline-test-key", input, signal: aborted.signal }),
    ).resolves.toEqual({ state: "uncertain" });

    const malformed = createZernioRestAdapter({
      fetch: vi.fn(async () => new Response("{}", { status: 201 })),
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    });
    await expect(malformed.createPost({ apiKey: "offline-test-key", input })).resolves.toEqual({
      state: "uncertain",
    });
  });

  it("requires exact post identity, content, schedule and one matching target", () => {
    const valid = parseZernioCreateResponse(201, { post: post() }, input);
    expect(valid).toEqual({
      state: "completed",
      postId: "post-1",
      platformPostUrl: proofUrl,
    });

    for (const invalid of [
      { post: post({ _id: "" }) },
      { post: post({ content: "different" }) },
      { post: post({ scheduledFor: "2030-01-02T04:04:05.000Z" }) },
      {
        post: post({
          platforms: [
            ...((post().platforms as unknown[]) ?? []),
            { platform: "linkedin", accountId: "account-2", status: "scheduled" },
          ],
        }),
      },
      { post: post({ platforms: [{ platform: "threads", accountId: "account-1" }] }) },
    ]) {
      expect(parseZernioCreateResponse(201, invalid, input).state).toBe("uncertain");
    }
  });

  it("keeps accepted scheduled posts open when public URL proof is absent", () => {
    const scheduled = post({
      platforms: [{ platform: input.platform, accountId: input.accountId, status: "scheduled" }],
    });
    expect(parseZernioCreateResponse(201, { post: scheduled }, input)).toEqual({
      state: "queued",
      postId: "post-1",
    });
  });

  it("requires a well-formed URL and documented status, and rejects ambiguous bodies", () => {
    const invalidTargets = [
      {
        platform: input.platform,
        accountId: input.accountId,
        status: "scheduled",
        platformPostUrl: null,
      },
      {
        platform: input.platform,
        accountId: input.accountId,
        status: "scheduled",
        platformPostUrl: proofUrl,
      },
      {
        platform: input.platform,
        accountId: input.accountId,
        status: "failed",
        platformPostUrl: proofUrl,
      },
      {
        platform: input.platform,
        accountId: input.accountId,
        status: "unknown",
        platformPostUrl: proofUrl,
      },
      { platform: input.platform, accountId: input.accountId, status: "published" },
      { platform: input.platform, accountId: input.accountId, status: "pending" },
    ];
    for (const target of invalidTargets) {
      expect(
        parseZernioCreateResponse(201, { post: post({ platforms: [target] }) }, input).state,
      ).toBe("uncertain");
    }
    expect(
      parseZernioCreateResponse(201, { success: true, error: "conflict", post: post() }, input)
        .state,
    ).toBe("uncertain");
  });

  it.each([202, 409, 500, 502])("treats HTTP %s as uncertain", (status) => {
    expect(parseZernioCreateResponse(status, { error: "provider response" }, input).state).toBe(
      "uncertain",
    );
  });

  it("only classifies explicit non-success responses without post identity as rejection", () => {
    expect(parseZernioCreateResponse(400, { error: "invalid request" }, input).state).toBe(
      "rejected",
    );
    expect(
      parseZernioCreateResponse(400, { postId: "post-1", error: "duplicate" }, input).state,
    ).toBe("uncertain");
    expect(parseZernioCreateResponse(429, "not-json", input).state).toBe("uncertain");
  });

  it("rejects unsafe proof URLs and throws as uncertainty without exposing provider bodies", async () => {
    const unsafe = parseZernioCreateResponse(
      201,
      {
        post: post({
          platforms: [
            {
              platform: input.platform,
              accountId: input.accountId,
              status: "published",
              platformPostUrl: "https://user:pass@x.example.test/post",
            },
          ],
        }),
      },
      input,
    );
    expect(unsafe.state).toBe("uncertain");

    const adapter = createZernioRestAdapter({
      fetch: vi.fn(async () => {
        throw new Error("provider body must not escape");
      }),
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    });
    await expect(adapter.createPost({ apiKey: "offline-test-key", input })).resolves.toEqual({
      state: "uncertain",
    });
  });

  it("loads exactly one scoped API-key credential and rejects OAuth or ambiguous candidates", async () => {
    const bot = {
      id: scope.botId,
      spaceId: scope.spaceId,
      userId: scope.userId,
      spawnKey: gtmAgentSpawnKey(scope.userId),
      archivedAt: null,
    };
    const server = {
      id: "server-1",
      spaceId: scope.spaceId,
      userId: scope.userId,
      agentBotId: scope.botId,
      endpoint: "https://mcp.zernio.com/mcp",
      enabled: true,
      writesEnabled: false,
      agentExclusive: true,
      secretId: "secret-1",
      agentBot: bot,
    };
    const secretStore = {
      load: vi.fn(async () =>
        JSON.stringify({ secret: "offline-key", headers: { Authorization: "ignored" } }),
      ),
    };
    const prisma = {
      mcpServer: { findMany: vi.fn(async () => [server]) },
      secret: {
        findFirst: vi.fn(async () => ({
          id: "secret-1",
          spaceId: scope.spaceId,
          userId: scope.userId,
          kind: "mcp",
          ciphertext: "encrypted",
        })),
      },
    };

    await expect(
      resolveZernioApiKey({ prisma: prisma as never, secretStore, scope }),
    ).resolves.toBe("offline-key");
    expect(prisma.secret.findFirst).toHaveBeenCalledWith({
      where: {
        id: "secret-1",
        spaceId: scope.spaceId,
        userId: scope.userId,
        kind: "mcp",
      },
    });

    secretStore.load.mockResolvedValue(JSON.stringify({ access_token: "oauth-token" }));
    await expect(
      resolveZernioApiKey({ prisma: prisma as never, secretStore, scope }),
    ).resolves.toBeNull();

    prisma.mcpServer.findMany.mockResolvedValue([server, { ...server, id: "server-2" }]);
    await expect(
      resolveZernioApiKey({ prisma: prisma as never, secretStore, scope }),
    ).resolves.toBeNull();
  });
});

function postingState() {
  const item = {
    id: "item-1",
    ...scope,
    title: "Approved post",
    status: "open",
    notes: input.content,
    category: "public_post",
    channel: "x",
    target: input.accountId,
    scheduledFor: new Date(input.scheduledFor),
    proof: null as string | null,
    approvedAt: new Date("2029-12-30T00:00:00.000Z"),
    approvedBy: "user",
    createdAt: new Date("2029-12-29T00:00:00.000Z"),
    updatedAt: new Date("2029-12-30T00:00:00.000Z"),
  };
  let effect: Record<string, unknown> | null = null;
  const matches = (where: Record<string, unknown>) => {
    for (const [key, expected] of Object.entries(where)) {
      if (key === "approvedAt" && expected && typeof expected === "object") {
        if (!item.approvedAt) return false;
      } else if (key === "scheduledFor" && expected instanceof Date) {
        if (item.scheduledFor.getTime() !== expected.getTime()) return false;
      } else if (key === "channel" && expected && typeof expected === "object") {
        if (!(expected as { in?: string[] }).in?.includes(item.channel)) return false;
      } else if (key in item && item[key as keyof typeof item] !== expected) {
        return false;
      }
    }
    return true;
  };
  const scratchpadItem = {
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      matches(where) ? [{ ...item }] : [],
    ),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      matches(where) ? { ...item } : null,
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(item, data);
        return { count: 1 };
      },
    ),
  };
  const externalEffect = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; idempotencyKey?: string } }) =>
      effect && (where.id ? effect.id === where.id : effect.idempotencyKey === where.idempotencyKey)
        ? effect
        : null,
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => {
        if (!effect || effect.id !== where.id || effect.status !== where.status)
          return { count: 0 };
        Object.assign(effect, data);
        return { count: 1 };
      },
    ),
  };
  const prisma = {
    scratchpadItem,
    externalEffect,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRaw: vi.fn(async () => []),
        $executeRaw: vi.fn(async () => 1),
        scratchpadItem,
      }),
    ),
  };
  const createEffect = vi.fn(async () => {
    if (!effect) {
      effect = {
        id: "effect-1",
        idempotencyKey: effectKey,
        ...scope,
        kind: "gtm_post",
        request: {
          content: input.content,
          scheduledFor: input.scheduledFor,
          accountId: input.accountId,
        },
        status: "intended",
        result: null,
      };
      return { duplicate: false, effect };
    }
    return { duplicate: true, effect };
  });
  const run = (
    dispatch: (args: ZernioCreateInput) => Promise<ZernioCreateResult>,
    overrides: Record<string, unknown> = {},
  ) =>
    executeApprovedGtmPost({
      prisma: prisma as never,
      scope,
      input: {
        content: input.content,
        scheduledFor: input.scheduledFor,
        accountId: input.accountId,
      },
      platform: input.platform,
      effectKey,
      createEffect,
      dispatch,
      now: () => new Date("2030-01-01T00:00:00.000Z"),
      ...overrides,
    });
  return {
    item,
    prisma,
    createEffect,
    run,
    getEffect: () => effect,
  };
}

describe("approved GTM post dispatch", () => {
  it("does not create an effect or dispatch when the exact approved tuple is missing", async () => {
    const state = postingState();
    state.item.notes = "different approved text";
    const dispatch = vi.fn(async () => ({
      state: "completed" as const,
      postId: "post-1",
      platformPostUrl: proofUrl,
    }));

    await state.run(dispatch);

    expect(state.createEffect).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(state.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("retains the stamp when the consumed channel no longer matches preflight", async () => {
    const state = postingState();
    const findFirst = state.prisma.scratchpadItem.findFirst;
    let replayChecked = false;
    findFirst.mockImplementation(async ({ where }) => {
      if (where.proof === effectKey) {
        replayChecked = true;
        return null;
      }
      if (replayChecked) state.item.channel = "linkedin";
      return state.item as never;
    });
    const dispatch = vi.fn(async () => ({
      state: "completed" as const,
      postId: "post-1",
      platformPostUrl: proofUrl,
    }));

    await state.run(dispatch);

    expect(state.item.proof).toBe(effectKey);
    expect(state.createEffect).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(
      state.prisma.scratchpadItem.updateMany.mock.calls.filter(
        ([args]) => args.data.proof === null,
      ),
    ).toHaveLength(0);
  });

  it("consumes the exact stamp before creating the effect and dispatching", async () => {
    const state = postingState();
    const order: string[] = [];
    const createEffect = vi.fn(async () => {
      expect(state.item.proof).toBe(effectKey);
      order.push("effect");
      return state.createEffect();
    });
    const dispatch = vi.fn(async () => {
      expect(state.item.proof).toBe(effectKey);
      order.push("dispatch");
      return { state: "completed" as const, postId: "post-1", platformPostUrl: proofUrl };
    });

    await state.run(dispatch, { createEffect });

    expect(order).toEqual(["effect", "dispatch"]);
    expect(state.item).toMatchObject({ status: "done", proof: proofUrl });
    expect(state.getEffect()).toMatchObject({ status: "completed" });
  });

  it("clears only the matching stamp for a definitive rejection", async () => {
    const state = postingState();
    const dispatch = vi.fn(async () => ({ state: "rejected" as const }));

    await state.run(dispatch);

    expect(state.item).toMatchObject({ status: "open", proof: null });
    expect(state.getEffect()).toMatchObject({ status: "completed" });
  });

  it("can resume its own stamp after effect creation failed before dispatch", async () => {
    const state = postingState();
    let fail = true;
    const createEffect = vi.fn(async () => {
      if (fail) {
        fail = false;
        throw new Error("synthetic effect store failure");
      }
      return state.createEffect();
    });
    const dispatch = vi.fn(async () => ({
      state: "completed" as const,
      postId: "post-1",
      platformPostUrl: proofUrl,
    }));

    await state.run(dispatch, { createEffect });
    expect(state.item.proof).toBe(effectKey);
    expect(dispatch).not.toHaveBeenCalled();

    await state.run(dispatch, { createEffect });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(state.createEffect).toHaveBeenCalledTimes(1);
    expect(state.item).toMatchObject({ status: "done", proof: proofUrl });
  });

  it("treats a completed result without a post ID as uncertain", async () => {
    const state = postingState();
    const dispatch = vi.fn(async () => ({
      state: "completed" as const,
      postId: "",
      platformPostUrl: proofUrl,
    }));

    await state.run(dispatch);

    expect(state.item).toMatchObject({ status: "open", proof: effectKey });
    expect(state.getEffect()).toMatchObject({ status: "uncertain" });
  });

  it("preserves the approval stamp after uncertain dispatch and never replays it", async () => {
    const state = postingState();
    const dispatch = vi.fn(async () => ({ state: "uncertain" as const }));

    await state.run(dispatch);
    await state.run(dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(state.item.proof).toBe(effectKey);
    expect(state.getEffect()).toMatchObject({ status: "uncertain" });
  });

  it("does not resend a completed effect", async () => {
    const state = postingState();
    const dispatch = vi.fn(async () => ({
      state: "completed" as const,
      postId: "post-1",
      platformPostUrl: proofUrl,
    }));

    await state.run(dispatch);
    await state.run(dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("allows only one concurrent dispatch for the same approved item and effect", async () => {
    const state = postingState();
    let release: ((value: ZernioCreateResult) => void) | undefined;
    const dispatch = vi.fn(
      async () =>
        new Promise<ZernioCreateResult>((resolve) => {
          release = resolve;
        }),
    );
    const first = state.run(dispatch);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const second = state.run(dispatch);
    release?.({ state: "completed", postId: "post-1", platformPostUrl: proofUrl });

    await Promise.all([first, second]);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("allows only one dispatch and consume when concurrent effect keys differ", async () => {
    const state = postingState();
    let release: ((value: ZernioCreateResult) => void) | undefined;
    const dispatch = vi.fn(
      async () =>
        new Promise<ZernioCreateResult>((resolve) => {
          release = resolve;
        }),
    );
    const first = state.run(dispatch);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const second = state.run(dispatch, { effectKey: "run:gtm_post:different-effect-key" });
    release?.({ state: "completed", postId: "post-1", platformPostUrl: proofUrl });

    await Promise.all([first, second]);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(
      state.prisma.scratchpadItem.updateMany.mock.calls.filter(
        ([args]) => args.data.proof === effectKey,
      ),
    ).toHaveLength(1);
  });
});
