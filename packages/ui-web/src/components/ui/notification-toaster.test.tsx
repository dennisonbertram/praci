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

it("shows one toast on a phone", async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  try {
    await mount();
    await add(3);
    expect(cards()).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
  }
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

const actionButton = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-slot="notification-toast"] button')].find(
    (b) => b.textContent === "Undo",
  );

it("renders an action as a button that runs it, closes the toast and does not open the link", async () => {
  const onOpen = vi.fn();
  const onClick = vi.fn();
  await mount(onOpen);
  await act(async () => {
    enqueueNotificationToast({
      id: "a1",
      title: "Deleted Ada",
      timeout: 0,
      href: "/x",
      action: { label: "Undo", onClick },
    });
  });
  // Clicking the text must not dismiss the toast and lose the action.
  await act(async () => (cards()[0]?.querySelector("span") as HTMLElement | null)?.click());
  expect(cards()).toHaveLength(1);
  await act(async () => actionButton()?.click());
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
  await expectClosed();
});

it("keeps a toast with an action open past the usual delay", () =>
  withFakeTimers(async () => {
    await mount();
    await act(async () => {
      enqueueNotificationToast({
        id: "a2",
        title: "Deleted Ada",
        timeout: 0,
        action: { label: "Undo", onClick: () => {} },
      });
    });
    await advance(60_000);
    expect(cards()).toHaveLength(1);
  }));

const addUndo = (n: number) =>
  act(async () => {
    for (let i = 1; i <= n; i++)
      enqueueNotificationToast({
        id: `a${i}`,
        title: `Deleted ${i}`,
        timeout: 0,
        action: { label: "Undo", onClick: () => {} },
      });
  });

it("keeps plain toasts for their full delay while three Undo toasts are pending", () =>
  withFakeTimers(async () => {
    await mount();
    await addUndo(3);
    await act(async () => enqueueNotificationToast({ id: "p1", title: "Chief finished" }));
    await advance(5_000);
    expect(document.body.textContent).toContain("Chief finished");
    expect(cards()).toHaveLength(4);
    await advance(SLOW);
    expect(document.body.textContent).not.toContain("Chief finished");
    expect(cards()).toHaveLength(3);
  }));

it("does not move focus when a plain toast arrives while Undo has focus", async () => {
  await mount();
  await addUndo(1);
  const undo = actionButton();
  await act(async () => undo?.focus());
  expect(document.activeElement).toBe(undo);
  await act(async () => enqueueNotificationToast({ id: "p1", title: "Chief finished" }));
  expect(document.activeElement).toBe(undo);
  expect(actionButton()).toBe(undo);
});

it("moves a toast with an action in front of toasts that arrive later", async () => {
  await mount();
  await act(async () => {
    enqueueNotificationToast({
      id: "a3",
      title: "Deleted Ada",
      timeout: 0,
      action: { label: "Undo", onClick: () => {} },
    });
  });
  await add(2);
  expect(cards()[0]?.textContent).toContain("Deleted Ada");
  expect(cards()).toHaveLength(3);
  expect(actionButton()).toBeDefined();
});

it("renders a toast without an action as before: one button for the card, no action button", async () => {
  await mount();
  await add(1);
  expect(cards()[0]?.hasAttribute("data-has-action")).toBe(false);
  expect(cards()[0]?.querySelectorAll("button")).toHaveLength(2);
});

it("caps the column of Undo toasts so the newest one stays reachable", async () => {
  await mount();
  await addUndo(5);
  const column = cards()[0]?.parentElement as HTMLElement;
  expect(column.className).toContain("max-h-");
  expect(column.className).toContain("overflow-y-auto");
  expect(cards()[0]?.textContent).toContain("Deleted 5");
});

it("reserves the peek of the rear sheets above the front toast", async () => {
  await mount();
  await add(3);
  const stack = cards()[0]?.parentElement as HTMLElement;
  // jsdom measures no heights, so the front is 0px and two rear sheets reserve 2 x 16px.
  expect(stack.style.getPropertyValue("--stack")).toBe("32px");
});

it("sits at the bottom, clear of the page header and its buttons", async () => {
  await mount();
  const classes = viewport()?.className ?? "";
  expect(classes).toContain("bottom-[max(1rem,");
  expect(classes).not.toMatch(/(^|\s)(max-sm:)?top-/);
});

it("runs onClose when a toast is closed", async () => {
  const onClose = vi.fn();
  await mount();
  await add(1, { onClose });
  await act(async () => document.querySelector<HTMLElement>("[aria-label=Dismiss]")?.click());
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("keeps the toast and its Dismiss button in the accessibility tree", async () => {
  await mount();
  await add(1);
  expect(cards()[0]?.getAttribute("aria-hidden")).not.toBe("true");
  expect(document.querySelector("[aria-label=Dismiss]")?.getAttribute("aria-hidden")).not.toBe(
    "true",
  );
});

it("hides while a dialog, menu or the drawer is open", async () => {
  await mount();
  expect(viewport()?.className).toContain("[role=dialog][data-open]");
  expect(viewport()?.className).toContain("[data-drawer-open]");
});

it("rises above a composer it would cover", async () => {
  await mount();
  const composer = document.createElement("div");
  composer.setAttribute("data-toast-avoid", "");
  composer.getBoundingClientRect = () =>
    ({
      top: 600,
      bottom: 760,
      left: 0,
      right: window.innerWidth,
      height: 160,
      width: window.innerWidth,
    }) as DOMRect;
  viewport()!.getBoundingClientRect = () =>
    ({ top: 500, bottom: 600, left: 100, right: 500, height: 100, width: 400 }) as DOMRect;
  document.body.append(composer);
  await add(1);
  // innerHeight 768 - 600 + 8
  expect(viewport()?.style.getPropertyValue("--toast-lift")).toBe("176px");
  // The thread pads by the toast height plus a gap so its last message stays readable.
  expect(document.documentElement.style.getPropertyValue("--toast-reserve")).toBe("108px");
});

it("sits left of an open side panel, narrowed to the main column when it is narrow", async () => {
  await mount();
  const panel = document.createElement("aside");
  panel.setAttribute("data-toast-panel", "");
  panel.getBoundingClientRect = () =>
    ({ top: 0, bottom: 768, left: 640, right: 1024, height: 768, width: 384 }) as DOMRect;
  document.body.append(panel);
  await add(1);
  // innerWidth 1024 - 640, plus the chat column's 28px padding less the 16px viewport gutter
  expect(viewport()?.style.getPropertyValue("--toast-shift")).toBe("396px");
  expect(viewport()?.style.getPropertyValue("--toast-max-width")).toBe("584px");
  expect(viewport()?.className).toContain("var(--toast-shift,0px)");
  expect(viewport()?.className).toContain("var(--toast-max-width,100vw)");
  expect(viewport()?.className).toContain(
    "max-sm:bottom-[max(calc(env(safe-area-inset-bottom)+1rem)",
  );
  panel.remove();
});

it("narrows to the main column instead of covering the panel when little room is left", async () => {
  await mount();
  const panel = document.createElement("aside");
  panel.setAttribute("data-toast-panel", "");
  window.innerWidth = 768;
  panel.getBoundingClientRect = () =>
    ({ top: 0, bottom: 768, left: 384, right: 768, height: 768, width: 384 }) as DOMRect;
  document.body.append(panel);
  await add(1);
  expect(viewport()?.style.getPropertyValue("--toast-shift")).toBe("396px");
  expect(viewport()?.style.getPropertyValue("--toast-max-width")).toBe("328px");
  panel.remove();
  window.innerWidth = 1024;
});

it("keeps the front card's height following its content, so a wrapped body is never cut", async () => {
  await mount();
  await add(1);
  const className = cards()[0]?.className ?? "";
  expect(className).toContain("min-h-[var(--height)]");
  expect(className).not.toMatch(/(^|\s)h-\[var\(--height\)\]/);
});

it("pads the page by the toast height when no composer is under it, and marks a linked toast", async () => {
  await mount();
  viewport()!.getBoundingClientRect = () =>
    ({ top: 600, bottom: 672, left: 100, right: 500, height: 72, width: 400 }) as DOMRect;
  await add(1, { href: "/app/legal" });
  // innerHeight 768 - 600: the card's height plus its offset from the window edge, nothing more.
  expect(document.documentElement.style.getPropertyValue("--toast-page-reserve")).toBe("168px");
  const chevron = document.querySelector('[data-slot="notification-toast"] button svg');
  expect(chevron).not.toBeNull();
  // On touch the 44px Dismiss target covers the corner; the chevron must sit left of it.
  expect(chevron?.getAttribute("class")).toContain("pointer-coarse:right-14");
});
