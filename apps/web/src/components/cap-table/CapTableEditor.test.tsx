// @vitest-environment jsdom

import type { CapTableSnapshot, CapTableSnapshotInput } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import type { SaveResult } from "./CapTableEditor";
import { CapTableEditor } from "./CapTableEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const snapshot: CapTableSnapshot = {
  companyName: "Example Co",
  asOf: "2026-10-20",
  source: "native",
  sourceRef: null,
  canUndo: false,
  fullyDilutedShares: 9_000_000,
  amountRaisedUsd: null,
  optionPoolAvailable: 1_000_000,
  latest409a: null,
  shareClasses: [],
  holders: [
    {
      id: "h1",
      name: "Founder Example",
      email: null,
      organization: null,
      security: "Common",
      shares: 6_000_000,
      amountUsd: null,
      percent: null,
    },
    {
      id: "h2",
      name: "Ada Example",
      email: null,
      organization: null,
      security: "Seed Preferred",
      shares: 2_000_000,
      amountUsd: 500_000,
      percent: null,
    },
    {
      id: "h3",
      name: "Cy Capital",
      email: null,
      organization: null,
      security: "Seed Preferred",
      shares: 1_000_000,
      amountUsd: null,
      percent: null,
    },
  ],
  updatedAt: "2026-10-20T10:00:00.000Z",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onSave = vi.fn(
  async (_table: CapTableSnapshotInput, _loadedAt: string): Promise<SaveResult> => ({
    updatedAt: "2026-10-20T10:01:00.000Z",
  }),
);
const flush = () => act(async () => {});
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
    (item) => item.textContent === label,
  );
const rowActions = (name: string) =>
  container.querySelector<HTMLElement>(`button[aria-label="Actions for ${name}"]`) ?? undefined;
const click = (el: Element | undefined) =>
  act(async () => (el as HTMLElement | undefined)?.click());
const toastUndo = (title: string) => {
  const toast = [...document.querySelectorAll<HTMLElement>("[data-slot=notification-toast]")].find(
    (el) => el.textContent?.includes(title),
  );
  return [...(toast?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Undo");
};
const savedNames = (call: number) =>
  onSave.mock.calls[call]?.[0].holders.map((holder) => holder.name);

const show = async () => {
  await act(async () =>
    root.render(
      <>
        <CapTableEditor
          snapshot={snapshot}
          onSave={onSave}
          contactIdFor={() => null}
          onAddContact={() => {}}
          onOpenContact={() => {}}
        />
        <NotificationToaster onOpen={() => {}} />
      </>,
    ),
  );
  await flush();
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => notificationToastManager.close());
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("saves a deleted holder at once, and Undo puts the row back where it was", async () => {
  await show();
  await click(rowActions("Ada Example"));
  await click(menuItem("Delete holder"));
  await flush();
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(savedNames(0)).toEqual(["Founder Example", "Cy Capital"]);
  expect(document.body.textContent).toContain("Deleted Ada Example");
  await click(toastUndo("Deleted Ada Example"));
  await flush();
  expect(savedNames(1)).toEqual(["Founder Example", "Ada Example", "Cy Capital"]);
  expect(onSave).toHaveBeenCalledTimes(2);
});

it("gives two quick deletes two independent Undos", async () => {
  await show();
  await click(rowActions("Ada Example"));
  await click(menuItem("Delete holder"));
  await click(rowActions("Cy Capital"));
  await click(menuItem("Delete holder"));
  await flush();
  expect(onSave).toHaveBeenCalledTimes(2);
  await click(toastUndo("Deleted Cy Capital"));
  await flush();
  expect(savedNames(2)).toEqual(["Founder Example", "Cy Capital"]);
  await click(toastUndo("Deleted Ada Example"));
  await flush();
  expect(savedNames(3)).toEqual(["Founder Example", "Ada Example", "Cy Capital"]);
  expect(onSave).toHaveBeenCalledTimes(4);
});

it("closes the Undo toast when the editor unmounts, so a stale Undo saves nothing", async () => {
  await show();
  await click(rowActions("Ada Example"));
  await click(menuItem("Delete holder"));
  await flush();
  expect(document.body.textContent).toContain("Deleted Ada Example");
  // The source changing or leaving the page unmounts the editor; its toast goes with it.
  await act(async () => root.render(<NotificationToaster onOpen={() => {}} />));
  expect(document.body.textContent).not.toContain("Deleted Ada Example");
  expect(toastUndo("Deleted Ada Example")).toBeUndefined();
  expect(onSave).toHaveBeenCalledTimes(1);
});
