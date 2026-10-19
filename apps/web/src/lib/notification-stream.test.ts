import type { NotificationDto, NotificationSignal } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { followNotifications, type NotificationStreamDeps } from "./notification-stream";

const T = "2030-01-01T00:00:01.000Z";
const dto = (id: string, over: Partial<NotificationDto> = {}): NotificationDto => ({
  id,
  botId: null,
  surface: "thread",
  threadId: "t",
  title: id,
  body: null,
  link: "/app/b",
  importance: "attention",
  createdAt: T,
  seenAt: null,
  shownAt: null,
  ...over,
});

type Frame = NotificationSignal["id"];
function stream(frames: Frame[]) {
  const iterator = {
    returned: 0,
    async next() {
      const id = frames.shift();
      return id === undefined
        ? { done: true as const, value: undefined }
        : {
            done: false as const,
            value: { id, surface: "thread", importance: "attention" as const },
          };
    },
    async return() {
      iterator.returned += 1;
      return { done: true as const, value: undefined };
    },
  };
  return { iterator, iterable: { [Symbol.asyncIterator]: () => iterator } };
}

/** Runs until the scripted streams are used up, then aborts on the next subscribe. */
function setup(over: {
  pages?: Array<ReturnType<NotificationStreamDeps["list"]> | Error>;
  list?: NotificationStreamDeps["list"];
  streams: ReturnType<typeof stream>[];
  deliver?: NotificationStreamDeps["deliver"];
  now?: () => Date;
}) {
  const controller = new AbortController();
  const streams = [...over.streams];
  const pages = [...(over.pages ?? [])];
  const deliver = vi.fn(over.deliver ?? (async () => "toast" as const));
  const list = vi.fn<NotificationStreamDeps["list"]>(
    over.list ??
      (async () => {
        const next = pages.shift();
        if (next instanceof Error) throw next;
        return (await next) ?? { notifications: [], nextCursor: null };
      }),
  );
  const sleeps: number[] = [];
  const subscribe = vi.fn(async () => {
    const next = streams.shift();
    if (!next) {
      controller.abort();
      throw new Error("done");
    }
    return next.iterable;
  });
  const done = followNotifications(
    {
      subscribe,
      list,
      deliver,
      sleep: async (ms) => void sleeps.push(ms),
      now: over.now ?? (() => new Date("2030-01-01T00:00:00.000Z")),
    },
    controller.signal,
  );
  return { done, deliver, list, subscribe, sleeps };
}
const page = (notifications: NotificationDto[], nextCursor: string | null = null) =>
  Promise.resolve({ notifications, nextCursor });

describe("followNotifications", () => {
  it("ignores heartbeats and delivers an attention notification once", async () => {
    const { done, deliver, list } = setup({
      pages: [page([]), page([dto("n1")])],
      streams: [stream(["heartbeat", "n1"])],
    });
    await done;
    expect(list).toHaveBeenCalledTimes(2);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0]?.[0]).toMatchObject({ id: "n1" });
  });

  it("does not deliver info, seen or already shown notifications", async () => {
    const { done, deliver } = setup({
      pages: [
        page([]),
        page([
          dto("info", { importance: "info" }),
          dto("seen", { seenAt: T }),
          dto("shown", { shownAt: T }),
        ]),
      ],
      streams: [stream(["catch-up"])],
    });
    await done;
    expect(deliver).not.toHaveBeenCalled();
  });

  it("follows the server cursor so 101 rows with one timestamp are all delivered", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => dto(`r${String(i).padStart(3, "0")}`));
    const { done, deliver, list } = setup({
      pages: [page([]), page(rows.slice(0, 100), "cursor-100"), page(rows.slice(100))],
      streams: [stream(["catch-up"])],
    });
    await done;
    expect(deliver).toHaveBeenCalledTimes(101);
    expect(list.mock.calls[1]?.[0]).toEqual({ since: "2030-01-01T00:00:00.000Z" });
    expect(list.mock.calls[2]?.[0]).toEqual({ cursor: "cursor-100" });
  });

  it("resumes from a cursor shortly before the newest row and does not repeat deliveries", async () => {
    const { done, deliver, list } = setup({
      pages: [
        page([dto("a")]),
        page([dto("a"), dto("b", { createdAt: "2030-01-01T00:00:05.000Z" })]),
      ],
      streams: [stream([]), stream([])],
    });
    await done;
    expect(deliver.mock.calls.map((c) => c[0].id)).toEqual(["a", "b"]);
    // 5 seconds before the newest row, so a row that committed late is still found.
    expect(list.mock.calls[1]?.[0]).toEqual({ cursor: "2029-12-31T23:59:56.000Z|0" });
  });

  it("retries a failed delivery on the next catch-up, then gives up after three tries", async () => {
    const { done, deliver } = setup({
      pages: [page([dto("f")]), page([]), page([]), page([]), page([])],
      streams: [stream(["x", "y", "z"])],
      deliver: async () => "failed",
    });
    await done;
    expect(deliver).toHaveBeenCalledTimes(3);
  });

  it("does not retry a delivery that was skipped or shown", async () => {
    const { done, deliver } = setup({
      pages: [page([dto("s")]), page([]), page([])],
      streams: [stream(["x", "y"])],
      deliver: async () => "skipped",
    });
    await done;
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("closes every stream, including when the first list fails", async () => {
    const first = stream(["x"]);
    const second = stream([]);
    const { done, subscribe } = setup({
      pages: [new Error("list down"), page([]), page([])],
      streams: [first, second],
    });
    await done;
    expect(subscribe).toHaveBeenCalledTimes(3);
    expect(first.iterator.returned).toBe(1);
    expect(second.iterator.returned).toBe(1);
  });

  it("backs off further while streams keep failing and resets after a healthy one", async () => {
    const failing = () => stream([]);
    const healthy = stream(["heartbeat"]);
    const { done, sleeps } = setup({
      list: async () => ({ notifications: [], nextCursor: null }),
      streams: [failing(), failing(), failing(), healthy, failing()],
    });
    await done;
    // Three empty streams: 2s, 4s, 8s. A stream that sent a frame resets to 1s; then 2s.
    expect(sleeps.slice(0, 5)).toEqual([2000, 4000, 8000, 1000, 2000]);
  });
});
