import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExpoPushProvider,
  expoPushData,
  expoPushErrorMessage,
  MAX_EXPO_PUSH_RESPONSE_BYTES,
} from "./expo-push.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

type Row = { id: string; userId: string; address: string; sessionId: string | null };

/** The slice of Prisma the provider reads, over an array: no database needed. */
function fakeStore() {
  const rows: Row[] = [];
  const prisma = {
    notificationEndpoint: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        rows.filter((row) => row.userId === where.userId).map((row) => ({ ...row })),
      deleteMany: async ({ where }: { where: { id: string; sessionId: string | null } }) => {
        const at = rows.findIndex((r) => r.id === where.id && r.sessionId === where.sessionId);
        if (at >= 0) rows.splice(at, 1);
        return { count: at >= 0 ? 1 : 0 };
      },
    },
  } as never;
  return {
    prisma,
    add: (userId: string, address: string, sessionId?: string) => {
      for (const [at, row] of rows.entries()) if (row.address === address) rows.splice(at, 1);
      rows.push({
        id: `e${rows.length}-${address}`,
        userId,
        address,
        sessionId: sessionId ?? null,
      });
    },
    retarget: (from: string, to: string) => {
      for (const row of rows) if (row.sessionId === from) row.sessionId = to;
    },
    tokens: (userId: string) => rows.filter((r) => r.userId === userId).map((r) => r.address),
  };
}

const notifyContext = {
  operationId: "n",
  traceId: "n",
  spaceId: "w",
  userId: "user-1",
  signal: new AbortController().signal,
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

describe("expo push tickets", () => {
  it("reads a single Expo ticket and a ticket array", () => {
    expect(expoPushErrorMessage({ data: { status: "ok", id: "1" } }, 200)).toBeUndefined();
    expect(expoPushErrorMessage({ data: { status: "error", message: "bad token" } }, 200)).toBe(
      "bad token",
    );
    expect(expoPushErrorMessage({ errors: [{ message: "rate limited" }] }, 429)).toBe(
      "rate limited",
    );
    expect(expoPushErrorMessage(undefined, 502)).toBe("expo push failed (502)");
    expect(
      expoPushErrorMessage(
        { data: { status: "error", details: { error: "DeviceNotRegistered" } } },
        200,
      ),
    ).toBe("DeviceNotRegistered");
  });
});

describe("expo push", () => {
  it("does not call Expo when the user has no token", async () => {
    const store = fakeStore();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma);
    await push.send(
      { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
      {
        operationId: "n",
        traceId: "n",
        spaceId: "w",
        userId: "missing",
        signal: new AbortController().signal,
      },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(push.hasPushRecipient("missing")).resolves.toBe(false);
    await expect(
      push.deliver(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        {
          operationId: "n",
          traceId: "n",
          spaceId: "w",
          userId: "missing",
          signal: new AbortController().signal,
        },
      ),
    ).resolves.toBe("undeliverable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Expo when a token is registered", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: { status: "ok", id: "ticket" } })),
      );
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma);
    await push.send(
      { kind: "takeover", title: "Need you", body: "on screen", botId: "bot-1", threadId: "th-1" },
      notifyContext,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    const body = JSON.parse(String(init.body)) as {
      to: string;
      title: string;
      collapseId: string;
      tag: string;
      data: { kind: string; deliveryId: string };
    };
    expect(body.to).toBe("ExponentPushToken[test]");
    expect(body.title).toBe("Need you");
    expect(body.collapseId).toBe("th-1");
    expect(body.tag).toBe("th-1");
    expect(body.data).toEqual({
      kind: "takeover",
      botId: "bot-1",
      threadId: "th-1",
      spaceId: "w",
      deliveryId: expect.any(String),
    });
    expect(body.data.deliveryId.length).toBeGreaterThan(0);

    await push.send(
      { kind: "takeover", title: "Need you", body: "on screen", botId: "bot-1", threadId: "th-1" },
      notifyContext,
    );
    const secondInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const secondBody = JSON.parse(String(secondInit.body)) as { data: { deliveryId: string } };
    expect(secondBody.data.deliveryId).not.toBe(body.data.deliveryId);
  });

  it("puts the space and group on the payload a tap opens", () => {
    expect(
      expoPushData(
        {
          kind: "completion",
          title: "done",
          body: "ok",
          botId: "bot-1",
          threadId: "thread-1",
          groupId: "group-1",
        },
        "space-1",
        "delivery-1",
      ),
    ).toEqual({
      kind: "completion",
      botId: "bot-1",
      threadId: "thread-1",
      spaceId: "space-1",
      groupId: "group-1",
      deliveryId: "delivery-1",
    });
    expect(
      expoPushData(
        { kind: "completion", title: "done", body: "ok", botId: "bot-1", threadId: "thread-1" },
        "",
        "delivery-2",
      ),
    ).toEqual({
      kind: "completion",
      botId: "bot-1",
      threadId: "thread-1",
      deliveryId: "delivery-2",
    });
  });

  it("does not deliver a token whose session row is gone, and leaves it to be retargeted", async () => {
    const store = fakeStore();
    const token = "ExponentPushToken[test]";
    store.add("user-1", token, "session-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma, async () => null);

    await expect(
      push.deliver(
        { kind: "completion", title: "done", body: "secret", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).resolves.toBe("undeliverable");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.tokens("user-1")).toEqual([token]);
    await expect(push.hasPushRecipient("user-1")).resolves.toBe(false);

    store.retarget("session-1", "session-2");
    expect(store.tokens("user-1")).toEqual([token]);
    const replaced = new ExpoPushProvider(store.prisma, async (sessionId) =>
      sessionId === "session-2" ? new Date(Date.now() + 60_000) : null,
    );
    await expect(replaced.hasPushRecipient("user-1")).resolves.toBe(true);
  });

  it("does not deliver a token whose session expiry has passed", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]", "session-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma, async () => new Date(Date.now() - 1_000));

    await expect(
      push.deliver(
        { kind: "completion", title: "done", body: "secret", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).resolves.toBe("undeliverable");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.tokens("user-1")).toEqual([]);
  });

  it("does not send a token another account claimed while the session was looked up", async () => {
    const store = fakeStore();
    const token = "ExponentPushToken[device]";
    store.add("user-1", token, "session-1");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma, async () => {
      waiting = true;
      await gate;
      return new Date(Date.now() + 60_000);
    });

    const delivering = push.deliver(
      { kind: "completion", title: "done", body: "secret", botId: "b", threadId: "t" },
      notifyContext,
    );
    await vi.waitFor(() => expect(waiting).toBe(true));
    store.add("user-2", token, "session-2");
    release();

    await expect(delivering).resolves.toBe("undeliverable");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.tokens("user-1")).toEqual([]);
    expect(store.tokens("user-2")).toEqual([token]);
  });

  it("delivers when the registering session is still live", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]", "session-1");
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: { status: "ok", id: "ticket" } })),
      );
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma, async () => new Date(Date.now() + 60_000));

    await expect(
      push.deliver(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).resolves.toBe("delivered");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not deliver a session-bound token when it cannot check the session", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]", "session-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma);

    await expect(
      push.deliver(
        { kind: "completion", title: "done", body: "secret", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).resolves.toBe("undeliverable");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.tokens("user-1")).toEqual(["ExponentPushToken[test]"]);
  });

  it("keeps the token when the session lookup fails", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]", "session-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const push = new ExpoPushProvider(store.prisma, async () => {
      throw new Error("database unavailable");
    });

    await expect(
      push.deliver(
        { kind: "completion", title: "done", body: "secret", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).resolves.toBe("undeliverable");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.tokens("user-1")).toEqual(["ExponentPushToken[test]"]);
  });

  it("throws when Expo rejects the request", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: "boom" }] }, 500)),
    );
    const push = new ExpoPushProvider(store.prisma);
    await expect(
      push.send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).rejects.toThrow("boom");
  });

  it("rejects and cancels a declared oversized response", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    const response = new Response("oversized", {
      headers: { "content-length": String(MAX_EXPO_PUSH_RESPONSE_BYTES + 1) },
    });
    const cancel = vi.spyOn(response.body!, "cancel");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      new ExpoPushProvider(store.prisma).send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).rejects.toThrow("Expo push response is too large.");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does not wait past cancellation when an oversized body cancel hangs", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    let cancelStarted = false;
    const hangingBody = new ReadableStream<Uint8Array>({
      cancel() {
        cancelStarted = true;
        return new Promise(() => undefined);
      },
    });
    const abort = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        setTimeout(() => abort.abort(), 20);
        return new Response(hangingBody, {
          headers: { "content-length": String(MAX_EXPO_PUSH_RESPONSE_BYTES + 1) },
        });
      }),
    );

    const started = Date.now();
    await expect(
      new ExpoPushProvider(store.prisma).send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        { ...notifyContext, signal: abort.signal },
      ),
    ).rejects.toThrow("Expo push response is too large.");
    expect(cancelStarted).toBe(true);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("caps a streamed response without a content length", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array(MAX_EXPO_PUSH_RESPONSE_BYTES + 1))),
    );

    await expect(
      new ExpoPushProvider(store.prisma).send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).rejects.toThrow("Expo push response is too large.");
  });

  it("rejects malformed successful responses", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));

    await expect(
      new ExpoPushProvider(store.prisma).send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).rejects.toThrow("Expo push returned an invalid response.");
  });

  it("passes caller cancellation to the Expo request", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    const controller = new AbortController();
    controller.abort(new Error("notification cancelled"));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal?.aborted).toBe(true);
      throw init?.signal?.reason;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new ExpoPushProvider(store.prisma).send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        { ...notifyContext, signal: controller.signal },
      ),
    ).rejects.toThrow("notification cancelled");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when the Expo request never reaches the network", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[test]");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const push = new ExpoPushProvider(store.prisma);
    await expect(
      push.send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).rejects.toThrow("offline");
  });

  it("reports DeviceNotRegistered without deleting a stored or replacement token", async () => {
    const store = fakeStore();
    store.add("user-1", "ExponentPushToken[old]");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        store.add("user-1", "ExponentPushToken[new]");
        return jsonResponse({
          data: { status: "error", details: { error: "DeviceNotRegistered" } },
        });
      }),
    );
    const push = new ExpoPushProvider(store.prisma);
    await expect(
      push.send(
        { kind: "completion", title: "done", body: "ok", botId: "b", threadId: "t" },
        notifyContext,
      ),
    ).rejects.toThrow("DeviceNotRegistered");
    expect(store.tokens("user-1")).toEqual(["ExponentPushToken[old]", "ExponentPushToken[new]"]);
  });
});
