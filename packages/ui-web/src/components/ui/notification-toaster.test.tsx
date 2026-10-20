// @vitest-environment jsdom

import { Toast } from "@base-ui/react/toast";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { NotificationToastData } from "./notification-toaster.js";
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

const viewport = () =>
  document.querySelector<HTMLElement>("[data-base-ui-toast-viewport], [role=status]");
const advance = (ms: number) => act(async () => vi.advanceTimersByTime(ms));
const SLOW = 7_000;

async function withFakeTimers(run: () => Promise<void>) {
  vi.useFakeTimers();
  try {
    await run();
  } finally {
    vi.useRealTimers();
  }
}

it("fades out after the delay without marking seen", () =>
  withFakeTimers(async () => {
    const onSeen = vi.fn();
    await mount();
    await add(1, { onSeen });
    await advance(5_000);
    expect(cards()).toHaveLength(1);
    await advance(SLOW);
    expect(cards()).toHaveLength(0);
    expect(onSeen).not.toHaveBeenCalled();
  }));

it("pauses while the pointer is over the stack and resumes on leave", () =>
  withFakeTimers(async () => {
    await mount();
    await add(1);
    await act(async () => {
      viewport()?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      viewport()?.dispatchEvent(new MouseEvent("mouseenter"));
    });
    await advance(30_000);
    expect(cards()).toHaveLength(1);
    await act(async () => {
      viewport()?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      viewport()?.dispatchEvent(new MouseEvent("mouseleave"));
    });
    await advance(SLOW);
    expect(cards()).toHaveLength(0);
  }));

it("pauses while a toast has keyboard focus", () =>
  withFakeTimers(async () => {
    await mount();
    await add(1);
    const open = document.querySelector<HTMLButtonElement>(
      '[data-slot="notification-toast"] button',
    );
    await act(async () => open?.focus());
    await advance(30_000);
    expect(cards()).toHaveLength(1);
    await act(async () => open?.blur());
    await advance(SLOW);
    expect(cards()).toHaveLength(0);
  }));

it("announces politely and stacks newest first", async () => {
  await mount();
  await add(5);
  expect(viewport()?.getAttribute("role")).toBe("status");
  expect(viewport()?.getAttribute("aria-live")).toBe("polite");
  const front = document.querySelector('[data-slot="notification-toast"]');
  expect(front?.textContent).toContain("Title 5");
  expect(front?.querySelector('[data-slot="notification-toast-overflow"]')?.textContent).toBe("+2");
});

it("uses no slide under reduced motion", async () => {
  await mount();
  await add(1);
  const cls = (cards()[0] as HTMLElement).className;
  expect(cls).toContain("motion-reduce:transition-opacity");
  expect(cls).toContain("motion-reduce:data-[starting-style]:translate-y-");
});

it("dismisses with the close button", async () => {
  await mount();
  await add(1);
  const dismiss = document.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
  await act(async () => dismiss?.click());
  await expectClosed();
});

async function clickToast() {
  const open = document.querySelector<HTMLButtonElement>('[data-slot="notification-toast"] button');
  await act(async () => open?.click());
}
async function expectClosed() {
  for (let i = 0; i < 50 && cards().length > 0; i++)
    await act(async () => new Promise((r) => setTimeout(r, 20)));
  expect(cards()).toHaveLength(0);
}

it("click opens the link, then calls onSeen, then closes the toast", async () => {
  const calls: string[] = [];
  const onSeen = vi.fn(() => calls.push("seen"));
  await mount(vi.fn((href: string) => calls.push(`open ${href}`)));
  await add(1, { href: "/finance", onSeen });
  await clickToast();
  expect(calls).toEqual(["open /finance", "seen"]);
  await expectClosed();
});

it("still marks seen and closes when navigation rejects", async () => {
  const onSeen = vi.fn();
  await mount(vi.fn(async () => Promise.reject(new Error("nav"))));
  await add(1, { href: "/x", onSeen });
  await clickToast();
  expect(onSeen).toHaveBeenCalledTimes(1);
  await expectClosed();
});

it("closes through the manager it was given", async () => {
  const manager = Toast.createToastManager<NotificationToastData>();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<NotificationToaster onOpen={vi.fn()} manager={manager} />));
  unmount = () => act(async () => root.unmount());
  await act(async () => {
    manager.add({ id: "m1", title: "Mine", timeout: 0, data: { href: "/y" } });
  });
  await clickToast();
  await expectClosed();
});

it("shows the avatar, the time and a three-line body clamp on a neutral card", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(<NotificationToaster onOpen={vi.fn()} formatTime={(iso) => `at ${iso}`} />),
  );
  unmount = () => act(async () => root.unmount());
  await add(1, {
    body: "Long body",
    avatar: <i data-testid="avatar" />,
    createdAt: "2026-01-01T00:00:00Z",
  });
  const card = cards()[0] as HTMLElement;
  expect(card.querySelector('[data-testid="avatar"]')).not.toBeNull();
  expect(card.textContent).toContain("at 2026-01-01T00:00:00Z");
  expect(card.className).toContain("border-border");
  expect(card.className).not.toContain("border-warning");
  expect(card.querySelector(".line-clamp-3")?.textContent).toBe("Long body");
});

it("renders no avatar or time when the notification has none", async () => {
  await mount();
  await add(1);
  expect(cards()[0]?.querySelector("[data-testid]")).toBeNull();
  expect(cards()[0]?.querySelector("button")?.textContent).toBe("Title 1");
});
