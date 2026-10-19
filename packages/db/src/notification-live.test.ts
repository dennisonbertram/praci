import type { RealtimeFanout } from "@rakazo/adapter-kit";
import { expect, it } from "vitest";
import { createNotificationEvents, notificationTopic } from "./notification-live.js";

it("turns the empty reconnect payload into a catch-up signal and passes real ones through", async () => {
  let deliver: (payload: string) => void = () => {};
  const topics: string[] = [];
  const fanout = {
    subscribe: async (topic: string, fn: (payload: string) => void) => {
      topics.push(topic);
      deliver = fn;
      return async () => {};
    },
  } as unknown as RealtimeFanout;
  const owner = { spaceId: "s", userId: "u" };
  const abort = new AbortController();
  const stream = createNotificationEvents(fanout).follow(owner, abort.signal);
  const first = stream.next();
  await new Promise((r) => setTimeout(r, 20));
  expect(topics).toEqual([notificationTopic(owner)]);
  deliver("");
  expect((await first).value).toEqual({ id: "catch-up", surface: "", importance: "info" });
  deliver(JSON.stringify({ id: "n1", surface: "legal", importance: "attention" }));
  expect((await stream.next()).value).toEqual({
    id: "n1",
    surface: "legal",
    importance: "attention",
  });
  abort.abort();
});
