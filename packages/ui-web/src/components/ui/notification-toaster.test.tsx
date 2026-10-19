// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { enqueueNotificationToast, NotificationToaster } from "./notification-toaster.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  document.body.innerHTML = "";
});

async function mount(onOpen = vi.fn()) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<NotificationToaster onOpen={onOpen} />));
  unmount = () => act(async () => root.unmount());
  return onOpen;
}
const add = (n: number, extra = {}) =>
  act(async () => {
    for (let i = 1; i <= n; i++)
      enqueueNotificationToast({ id: `t${i}`, title: `Title ${i}`, ...extra });
  });
const cards = () => document.querySelectorAll('[data-slot="notification-toast"]');

it("shows three toasts and collapses the rest into +N", async () => {
  await mount();
  await add(5);
  expect(cards()).toHaveLength(3);
  expect(document.querySelector('[data-slot="notification-toast-overflow"]')?.textContent).toBe(
    "+2",
  );
});

it("keeps attention toasts until dismissed", async () => {
  vi.useFakeTimers();
  try {
    await mount();
    await add(1);
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(cards()).toHaveLength(1);
    const dismiss = document.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
    await act(async () => dismiss?.click());
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(cards()).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});

it("click opens the link, calls onSeen and closes the toast", async () => {
  const onSeen = vi.fn();
  const onOpen = await mount();
  await add(1, { href: "/finance", onSeen });
  const open = document.querySelector<HTMLButtonElement>('[data-slot="notification-toast"] button');
  await act(async () => open?.click());
  expect(onOpen).toHaveBeenCalledWith("/finance");
  expect(onSeen).toHaveBeenCalledTimes(1);
});
