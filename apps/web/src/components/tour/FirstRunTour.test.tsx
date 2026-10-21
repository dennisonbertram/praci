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
  const onConnectApps = vi.fn();
  await act(async () =>
    root.render(<FirstRunTour open onClose={onClose} onConnectApps={onConnectApps} />),
  );
  // Three anchors exist, so there are three steps.
  expect(document.body.textContent).toContain("1/3");
  await click("Next");
  expect(document.body.textContent).toContain("2/3");
  await click("Back");
  expect(document.body.textContent).toContain("1/3");
  await click("Next");
  await click("Next");
  expect(document.body.textContent).toContain("3/3");
  // The last step ends on an action: it records the tour, then opens Connect apps.
  expect(document.body.textContent).not.toContain("backups");
  await click("Connect apps");
  expect(update).toHaveBeenCalledWith({ tourSeen: true });
  expect(onClose).toHaveBeenCalled();
  expect(onConnectApps).toHaveBeenCalled();
});

it("records Skip tour", async () => {
  await act(async () =>
    root.render(<FirstRunTour open onClose={vi.fn()} onConnectApps={vi.fn()} />),
  );
  await click("Skip tour");
  expect(update).toHaveBeenCalledWith({ tourSeen: true });
});

it("shows nothing and saves nothing when closed or when no anchor exists", async () => {
  await act(async () =>
    root.render(<FirstRunTour open={false} onClose={vi.fn()} onConnectApps={vi.fn()} />),
  );
  expect(document.body.textContent).not.toContain("1/");
  for (const el of document.querySelectorAll("[data-tour]")) el.remove();
  const onClose = vi.fn();
  await act(async () =>
    root.render(<FirstRunTour open onClose={onClose} onConnectApps={vi.fn()} />),
  );
  expect(update).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledWith(null);
});
