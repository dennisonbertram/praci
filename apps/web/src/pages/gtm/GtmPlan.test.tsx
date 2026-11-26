// @vitest-environment jsdom

import type { ScratchpadItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const update = vi.hoisted(() => vi.fn(async () => ({})));
const queue = vi.hoisted(() =>
  vi.fn(async () => ({ status: "ready" as const, complete: true, posts: [] })),
);
vi.mock("../../lib/rpc", () => ({ rpc: { scratchpad: { update }, gtm: { queue } } }));

import { toDatetimeLocalValue } from "../../lib/datetime-local";
import { item, overview } from "./fixtures";
import { GtmItem } from "./GtmPlan";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const iso = "2026-11-03T15:31:42.338Z";
const fixedNow = new Date("2026-11-01T12:00:00.000Z");

afterEach(() => vi.useRealTimers());

async function mount(post: ScratchpadItem, planOverview = overview, onChange = () => {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(<GtmItem item={post} overview={planOverview} onChange={onChange} />),
  );
  return {
    container,
    done: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}
const click = (el: Element) => act(async () => (el as HTMLElement).click());
const button = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLElement;
const timeInput = (c: HTMLElement) =>
  c.querySelector<HTMLInputElement>('input[id^="gtm-scheduled-for-"]') as HTMLInputElement;

it("edits the time with a datetime-local field and sends it only when changed", async () => {
  update.mockClear();
  const { container, done } = await mount({ ...item, scheduledFor: iso });
  await click(button(container, "Edit"));
  const input = timeInput(container);
  expect(input.type).toBe("datetime-local");
  expect(input.value).toBe(toDatetimeLocalValue(new Date(iso)));
  expect(container.textContent).toContain("Scheduled time");
  expect(container.textContent).not.toContain("ISO");
  const editedValue = toDatetimeLocalValue(new Date(Date.now() + 60 * 60_000));
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      editedValue,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => container.querySelector("form")?.requestSubmit());
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ scheduledFor: new Date(editedValue).toISOString() }),
  );
  await done();
});

it("leaves the stored time alone when Save is pressed without changing it", async () => {
  update.mockClear();
  const scheduledFor = "2026-11-01T12:05:00.000Z";
  const { container, done } = await mount(
    { ...item, scheduledFor },
    { ...overview, nextRunAt: null },
  );
  await click(button(container, "Edit"));
  await act(async () => container.querySelector("form")?.requestSubmit());
  expect(update).toHaveBeenCalledTimes(1);
  expect((update.mock.calls[0] as unknown[])[0]).not.toHaveProperty("scheduledFor");
  await done();
});

it("does not offer Discard for an open post queued in Zernio", async () => {
  const { container, done } = await mount({
    ...item,
    status: "open",
    approvedAt: iso,
    approvedBy: "user",
    proof: "zernio:post_mock_1",
    scheduledFor: new Date(Date.now() + 60 * 60_000).toISOString(),
  });
  expect(button(container, "Discard")).toBeUndefined();
  await done();
});

it("shows a queued post without the raw Zernio id", async () => {
  const { container, done } = await mount({
    ...item,
    status: "open",
    approvedAt: iso,
    approvedBy: "user",
    proof: "zernio:post_mock_1",
  });
  expect(container.textContent).toContain("Queued in Zernio");
  expect(container.textContent).not.toContain("post_mock_1");
  await done();
});

it("keeps an edited time open and refuses Save when it is too close to the next run", async () => {
  update.mockClear();
  const nextRunAt = new Date().toISOString();
  const { container, done } = await mount(
    { ...item, scheduledFor: nextRunAt },
    { ...overview, nextRunAt },
  );
  await click(button(container, "Edit"));
  const input = timeInput(container);
  const editedValue = toDatetimeLocalValue(new Date(Date.now() + 5 * 60_000));
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      editedValue,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => container.querySelector("form")?.requestSubmit());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Schedule this post at least ten minutes after the next run.",
  );
  expect(timeInput(container).value).toBe(editedValue);
  expect(update).not.toHaveBeenCalled();
  await done();
});

it("refuses to Approve a parked post scheduled before the next-run floor", async () => {
  update.mockClear();
  const nextRunAt = new Date().toISOString();
  const { container, done } = await mount(
    { ...item, scheduledFor: new Date(Date.now() + 5 * 60_000).toISOString() },
    { ...overview, nextRunAt },
  );
  await click(button(container, "Approve"));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Schedule this post at least ten minutes after the next run.",
  );
  expect(update).not.toHaveBeenCalled();
  await done();
});

it("uses ten minutes after nextRunAt as the posting floor", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(fixedNow);
  update.mockClear();
  const nextRunAt = "2026-11-01T13:00:00.000Z";
  const { container, done } = await mount(
    { ...item, scheduledFor: "2026-11-01T13:05:00.000Z" },
    { ...overview, nextRunAt },
  );
  await click(button(container, "Approve"));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Schedule this post at least ten minutes after the next run.",
  );
  expect(update).not.toHaveBeenCalled();
  await done();

  const allowed = await mount(
    { ...item, scheduledFor: "2026-11-01T13:15:00.000Z" },
    { ...overview, nextRunAt },
  );
  await click(button(allowed.container, "Approve"));
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ itemId: item.id, status: "open" }));
  await allowed.done();
});

it("uses now plus ten minutes when nextRunAt is null", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(fixedNow);
  update.mockClear();
  const planOverview = { ...overview, nextRunAt: null };
  const tooSoon = await mount({ ...item, scheduledFor: "2026-11-01T12:09:00.000Z" }, planOverview);
  await click(button(tooSoon.container, "Approve"));
  expect(tooSoon.container.querySelector('[role="alert"]')?.textContent).toBe(
    "Schedule this post at least ten minutes after the next run.",
  );
  expect(update).not.toHaveBeenCalled();
  await tooSoon.done();

  const allowed = await mount({ ...item, scheduledFor: "2026-11-01T12:10:00.000Z" }, planOverview);
  await click(button(allowed.container, "Approve"));
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ itemId: item.id, status: "open" }));
  await allowed.done();
});

it("guards Re-approve with the same posting floor", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(fixedNow);
  update.mockClear();
  const { container, done } = await mount(
    {
      ...item,
      scheduledFor: "2026-11-01T13:05:00.000Z",
      proof: `post:demo:${"a".repeat(64)}`,
    },
    { ...overview, nextRunAt: "2026-11-01T13:00:00.000Z" },
  );
  await click(button(container, "Check queue"));
  const confirmation = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  await click(confirmation);
  await click(button(container, "Re-approve"));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Schedule this post at least ten minutes after the next run.",
  );
  expect(update).not.toHaveBeenCalled();
  await done();
});

it("refreshes the overview when approval reports a deleted item", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(fixedNow);
  update.mockRejectedValue({ code: "NOT_FOUND" });
  const onChange = vi.fn();
  const { container, done } = await mount(
    { ...item, scheduledFor: "2026-11-01T15:00:00.000Z" },
    overview,
    onChange,
  );
  await click(button(container, "Approve"));
  expect(onChange).toHaveBeenCalledTimes(1);
  await done();
});
