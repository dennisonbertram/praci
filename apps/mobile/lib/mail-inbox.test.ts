import { beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ rpc }));
vi.mock("./i18n", () => ({ t: (text: string) => text, dateLocaleForUi: () => "en-US" }));

import {
  archiveMailMessages,
  completeMailTodo,
  ensureMailAgent,
  getMailMessage,
  listMailInbox,
  listMailTodos,
  refreshMailInbox,
  todoDueLabel,
} from "./mail-inbox";

// Braces: a returned mock would run as the test's cleanup hook.
beforeEach(() => {
  rpc.mockReset().mockResolvedValue({});
});

it("calls the inbox procedures with the account only when one is chosen", async () => {
  await listMailInbox();
  await listMailInbox("c1");
  await listMailTodos("c1");
  await refreshMailInbox();
  await completeMailTodo("t1");
  await ensureMailAgent();
  await getMailMessage("m1");
  expect(rpc.mock.calls).toEqual([
    ["inbox/list", {}],
    ["inbox/list", { connectionId: "c1" }],
    ["inbox/todos/list", { connectionId: "c1" }],
    ["inbox/refresh", {}, { timeoutMs: 90_000 }],
    ["inbox/todos/setDone", { id: "t1", done: true }],
    ["inbox/agent"],
    ["inbox/get", { messageId: "m1" }],
  ]);
});

it("asks for a pile, with or without an account, and archives many messages in one call", async () => {
  await listMailInbox(undefined, "updates");
  await listMailInbox("c1", "spam");
  rpc.mockResolvedValue({ done: [], failed: [] });
  await archiveMailMessages(["m1", "m2"]);
  await archiveMailMessages(["m3"], true);
  expect(rpc.mock.calls).toEqual([
    ["inbox/list", { pile: "updates" }],
    ["inbox/list", { connectionId: "c1", pile: "spam" }],
    ["inbox/archiveMany", { messageIds: ["m1", "m2"] }],
    ["inbox/archiveMany", { messageIds: ["m3"], allowSpam: true }],
  ]);
});

it("labels a due date as Today, a weekday within six days, or month and day", () => {
  expect(todoDueLabel("2026-10-12", 0)).toBe("Today");
  expect(todoDueLabel("2026-10-14", 2)).toBe("Wed");
  expect(todoDueLabel("2026-10-18", 6)).toBe("Sun");
  expect(todoDueLabel("2026-10-19", 7)).toBe("Oct 19");
  expect(todoDueLabel("2026-10-10", -2)).toBe("Oct 10");
});

it("archives 120 messages in calls of at most 50", async () => {
  rpc.mockImplementation(async (_path: string, body: { messageIds: string[] }) => ({
    done: body.messageIds,
    failed: [],
  }));
  const ids = Array.from({ length: 120 }, (_, i) => `m${i}`);
  const result = await archiveMailMessages(ids);
  expect(rpc.mock.calls.map(([, body]) => body.messageIds.length)).toEqual([50, 50, 20]);
  expect(result.done).toEqual(ids);
});
