import type { NotificationDto, NotificationSignal } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { followNotifications } from "./notification-stream";

const dto = (id: string, over: Partial<NotificationDto> = {}): NotificationDto => ({
  id,
  botId: null,
  surface: "thread",
  threadId: "t",
  title: id,
  body: null,
  link: "/app/b",
  importance: "attention",
  createdAt: "2030-01-01T00:00:01.000Z",
  seenAt: null,
  shownAt: null,
  ...over,
});

async function* frames(...ids: string[]): AsyncGenerator<NotificationSignal> {
  for (const id of ids) yield { id, surface: "thread", importance: "attention" };
}

function setup(listed: NotificationDto[][], streams: AsyncIterable<NotificationSignal>[]) {
  const controller = new AbortController();
  const deliver = vi.fn();
  const list = vi.fn(async (_since: string) => ({
    notifications: listed.shift() ?? [],
    nextCursor: null,
  }));
  const subscribe = vi.fn(async () => {
    const next = streams.shift();
    if (!next) {
      controller.abort();
      throw new Error("done");
    }
    return next;
  });
  const done = followNotifications(
    {
      subscribe,
      list,
      deliver,
      sleep: async () => {},
      now: () => new Date("2030-01-01T00:00:00.000Z"),
    },
    controller.signal,
  );
  return { done, deliver, list, subscribe };
}

describe("followNotifications", () => {
  it("ignores heartbeats and delivers an attention notification once", async () => {
    // First list is the catch-up on connect; the second answers the real frame.
    const { done, deliver, list } = setup([[], [dto("n1")]], [frames("heartbeat", "n1")]);
    await done;
    expect(list).toHaveBeenCalledTimes(2);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0]?.[0]).toMatchObject({ id: "n1" });
  });

  it("does not deliver info, seen or already shown notifications", async () => {
    const { done, deliver } = setup(
      [
        [],
        [
          dto("info", { importance: "info" }),
          dto("seen", { seenAt: "2030-01-01T00:00:02.000Z" }),
          dto("shown", { shownAt: "2030-01-01T00:00:02.000Z" }),
        ],
      ],
      [frames("catch-up")],
    );
    await done;
    expect(deliver).not.toHaveBeenCalled();
  });

  it("catches up from the last notification after reconnecting, without repeats", async () => {
    const { done, deliver, list } = setup(
      [[dto("a")], [dto("a"), dto("b", { createdAt: "2030-01-01T00:00:05.000Z" })]],
      [frames(), frames()],
    );
    await done;
    expect(deliver.mock.calls.map((c) => c[0].id)).toEqual(["a", "b"]);
    expect(list.mock.calls[1]?.[0]).toBe("2030-01-01T00:00:01.000Z");
  });
});
