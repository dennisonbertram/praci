// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const tt = vi.hoisted(
  () =>
    (parts: TemplateStringsArray | string, ...values: unknown[]) =>
      typeof parts === "string"
        ? parts
        : parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: tt, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const update = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { preferences: { update } } }));

import { FirstRunTour } from "./FirstRunTour";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const anchors = ["sidebar-inbox", "user-menu", "sidebar-integrations"];

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  update.mockReset().mockResolvedValue({ tourSeen: true });
  document.body.innerHTML = "";
  for (const id of anchors) {
    const el = document.createElement("button");
    el.dataset.tour = id;
    document.body.append(el);
  }
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLElement;
const click = (label: string) =>
  act(async () => {
    button(label).click();
  });

it("skips steps whose anchor is missing, walks Next and Back, and records Done", async () => {
  const onClose = vi.fn();
  const onAsk = vi.fn();
  await act(async () => root.render(<FirstRunTour open onClose={onClose} onAsk={onAsk} />));
  // Three anchors exist, so there are three steps.
  expect(document.body.textContent).toContain("1/3");
  await click("Next");
  expect(document.body.textContent).toContain("2/3");
  await click("Back");
  expect(document.body.textContent).toContain("1/3");
  await click("Next");
  await click("Next");
  expect(document.body.textContent).toContain("3/3");
  // Done ends the tour and records it, without opening a chat.
  await click("Done");
  expect(update).toHaveBeenCalledWith({ tourSeen: true });
  expect(onClose).toHaveBeenCalled();
  expect(onAsk).not.toHaveBeenCalled();
});

it("offers Ask Chief beside Done on the last step only, and it ends the tour first", async () => {
  const onClose = vi.fn();
  const onAsk = vi.fn();
  await act(async () => root.render(<FirstRunTour open onClose={onClose} onAsk={onAsk} />));
  expect(button("Ask Chief")).toBeUndefined();
  await click("Next");
  await click("Next");
  await click("Ask Chief");
  expect(update).toHaveBeenCalledWith({ tourSeen: true });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onAsk).toHaveBeenCalledTimes(1);
});

it("keeps Back and the primary button in the same slots on every stop", async () => {
  await act(async () => root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} />));
  await click("Next");
  const middle = [button("Back").className, button("Next").className];
  await click("Next");
  // Last stop: Ask Chief replaces Skip tour on the left; Skip tour stays in place but hidden.
  expect(button("Back").className).toBe(middle[0]);
  expect(button("Done").className).toContain("min-w-16");
  expect(button("Next")).toBeUndefined();
  expect(button("Skip tour")?.className ?? "invisible").toContain("invisible");
});

it("records Skip tour", async () => {
  await act(async () => root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} />));
  await click("Skip tour");
  expect(update).toHaveBeenCalledWith({ tourSeen: true });
});

it("tells the shell about Skip tour, so Ask Chief stays one tap away, but not about Done", async () => {
  const onSkip = vi.fn();
  await act(async () =>
    root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} onSkip={onSkip} />),
  );
  await click("Skip tour");
  expect(onSkip).toHaveBeenCalledTimes(1);
  await act(async () =>
    root.render(<FirstRunTour open={false} onClose={vi.fn()} onAsk={vi.fn()} onSkip={onSkip} />),
  );
  await act(async () =>
    root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} onSkip={onSkip} />),
  );
  await click("Next");
  await click("Next");
  await click("Done");
  expect(onSkip).toHaveBeenCalledTimes(1);
});

it("on a phone the card sits right beside its target, below a high one and above a low one", async () => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  const rect = (top: number) =>
    ({ top, bottom: top + 40, left: 10, right: 300, width: 290, height: 40 }) as DOMRect;
  const at = (id: string, top: number) => {
    const el = document.querySelector(`[data-tour="${id}"]`) as HTMLElement;
    el.getBoundingClientRect = () => rect(top);
  };
  at("sidebar-inbox", 100);
  at("user-menu", 700);
  await act(async () => root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} />));
  const card = () => document.querySelector("[data-testid='tour-card']") as HTMLElement;
  // Upper-half target (bottom at 140): the card starts 8px under it.
  expect(card().style.top).toBe("148px");
  expect(card().style.bottom).toBe("");
  await click("Next");
  await click("Next");
  // Lower-half target (top at 700): the card ends 8px above it.
  expect(card().style.bottom).toBe(`${window.innerHeight - 700 + 8}px`);
  expect(card().style.top).toBe("");
});

it("on desktop the card sits beside the sidebar, level with its target", async () => {
  const aside = document.createElement("aside");
  aside.getBoundingClientRect = () =>
    ({
      top: 0,
      bottom: window.innerHeight,
      left: 0,
      right: 316,
      width: 316,
      height: window.innerHeight,
    }) as DOMRect;
  document.body.append(aside);
  const target = document.querySelector('[data-tour="sidebar-inbox"]') as HTMLElement;
  aside.append(target);
  target.getBoundingClientRect = () =>
    ({ top: 100, bottom: 140, left: 10, right: 300, width: 290, height: 40 }) as DOMRect;
  await act(async () => root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} />));
  const card = document.querySelector("[data-testid='tour-card']") as HTMLElement;
  // Target centre y=120, clamped to at least 96; the card starts 8px right of the sidebar.
  expect(card.style.top).toBe("120px");
  expect(card.style.left).toBe("324px");
  expect(card.style.width).toBe("288px");
});

it("does not tell anyone to connect Gmail, which may already be connected", async () => {
  for (const el of document.querySelectorAll("[data-tour]")) el.remove();
  const el = document.createElement("button");
  el.dataset.tour = "sidebar-integrations";
  document.body.append(el);
  await act(async () => root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} />));
  expect(document.body.textContent).toContain("add more in Integrations");
  expect(document.body.textContent).not.toContain("Gmail");
});

it("shows nothing and saves nothing when closed or when no anchor exists", async () => {
  await act(async () =>
    root.render(<FirstRunTour open={false} onClose={vi.fn()} onAsk={vi.fn()} />),
  );
  expect(document.body.textContent).not.toContain("1/");
  for (const el of document.querySelectorAll("[data-tour]")) el.remove();
  const onClose = vi.fn();
  await act(async () => root.render(<FirstRunTour open onClose={onClose} onAsk={vi.fn()} />));
  expect(update).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledWith(null);
});

it("closes the tour on the last step's action without waiting for the save", async () => {
  update.mockReturnValue(new Promise(() => undefined));
  const onClose = vi.fn();
  await act(async () => root.render(<FirstRunTour open onClose={onClose} onAsk={vi.fn()} />));
  await click("Next");
  await click("Next");
  await click("Ask Chief");
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("is a complete tour, top to bottom, ending on the composer", async () => {
  for (const el of document.querySelectorAll("[data-tour]")) el.remove();
  const order = [
    "sidebar-search",
    "create-menu",
    "sidebar-inbox",
    "sidebar-finance",
    "sidebar-legal",
    "sidebar-data-room",
    "sidebar-chat",
    "sidebar-integrations",
    "user-menu",
  ];
  for (const id of order) {
    const el = document.createElement("button");
    el.dataset.tour = id;
    document.body.append(el);
  }
  await act(async () => root.render(<FirstRunTour open onClose={vi.fn()} onAsk={vi.fn()} />));
  const seen: string[] = [];
  for (let i = 0; i < order.length; i++) {
    seen.push(document.querySelector("[data-testid='tour-popover'] p")?.textContent ?? "");
    if (i < order.length - 1) await click("Next");
  }
  expect(document.body.textContent).toContain("9/9");
  expect(seen[0]).toContain("find any page, chat");
  expect(seen[6]).toContain("Ask Chief");
  expect(seen[1]).toContain("create a bot");
  // New users already ask before email and purchases, so the tour sends nobody to Settings.
  expect(seen[6]).not.toContain("Settings");
  expect(seen[7]).toContain("Integrations");
  expect(seen[7]).toContain("bots");
  expect(seen.join(" ")).not.toMatch(/agent|apps/i);
  expect(seen[8]).toContain("retake this tour");
  expect(button("Done")).toBeTruthy();
  expect(button("Ask Chief")).toBeTruthy();
});

it("ends on Escape before the drawer's own Escape handler sees it", async () => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  const drawer = vi.fn();
  document.addEventListener("keydown", drawer);
  const onClose = vi.fn();
  await act(async () => root.render(<FirstRunTour open onClose={onClose} onAsk={vi.fn()} />));
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  document.removeEventListener("keydown", drawer);
  expect(onClose).toHaveBeenCalledWith(null, true);
  expect(drawer).not.toHaveBeenCalled();
});
