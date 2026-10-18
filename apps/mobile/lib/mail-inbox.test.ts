import { beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ rpc }));
vi.mock("./i18n", () => ({ t: (text: string) => text, dateLocaleForUi: () => "en-US" }));

import {
  completeMailTodo,
  ensureMailAgent,
  getMailMessage,
  listMailInbox,
  listMailTodos,
  refreshMailInbox,
  todoDueLabel,
} from "./mail-inbox";

beforeEach(() => rpc.mockReset().mockResolvedValue({}));

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

it("labels a due date as Today, a weekday within six days, or month and day", () => {
  expect(todoDueLabel("2026-10-12", 0)).toBe("Today");
  expect(todoDueLabel("2026-10-14", 2)).toBe("Wed");
  expect(todoDueLabel("2026-10-18", 6)).toBe("Sun");
  expect(todoDueLabel("2026-10-19", 7)).toBe("Oct 19");
  expect(todoDueLabel("2026-10-10", -2)).toBe("Oct 10");
});
