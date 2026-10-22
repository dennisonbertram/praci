// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const upload = vi.hoisted(() => vi.fn());
const toasts = vi.hoisted((): UploadToast[] => []);
vi.mock("./upload-toasts", () => ({
  uploadFilesToDataRoom: upload,
  setUploadScope: () => undefined,
  dismissUploadToast: () => undefined,
  getUploadToasts: () => toasts,
  subscribeUploadToasts: () => () => undefined,
}));

import { DataRoomDropZone } from "./DropZone";
import type { UploadToast } from "./upload-toasts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter>
        <DataRoomDropZone userId="u1" />
        {/* An existing drop target, like the composer or the statement import. */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for real drop targets. */}
        <div
          data-testid="claimed"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
        />
        <div data-testid="plain" />
      </MemoryRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  toasts.length = 0;
  vi.clearAllMocks();
});

function fire(target: Element, type: string) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: ["Files"], files: [new File(["x"], "a.txt")] },
  });
  act(() => {
    target.dispatchEvent(event);
  });
}
const overlay = () => document.querySelector('[data-testid="data-room-drop-overlay"]');
const target = (id: string) => container.querySelector(`[data-testid="${id}"]`) as Element;

it("uploads a file dropped on the page", () => {
  fire(target("plain"), "dragenter");
  fire(target("plain"), "dragover");
  expect(overlay()).not.toBeNull();
  fire(target("plain"), "drop");
  expect(upload).toHaveBeenCalledTimes(1);
  expect(overlay()).toBeNull();
});

it("leaves a drop to the target that already handled it, and hides the overlay over it", () => {
  fire(target("claimed"), "dragenter");
  fire(target("claimed"), "dragover");
  expect(overlay()).toBeNull();
  fire(target("claimed"), "drop");
  expect(upload).not.toHaveBeenCalled();
  // Back over the plain page the overlay returns.
  fire(target("plain"), "dragenter");
  fire(target("plain"), "dragover");
  expect(overlay()).not.toBeNull();
});

it("says which folder a duplicate is already in, and confirms a delete", () => {
  toasts.push(
    {
      id: 1,
      name: "lease.pdf",
      state: { kind: "uploaded", itemId: "i1", existing: { folder: "Legal" } },
    },
    {
      id: 2,
      name: "lease copy.pdf",
      state: { kind: "uploaded", itemId: "i1", existing: { name: "lease.pdf", folder: "Legal" } },
    },
    { id: 3, name: "notes.txt", state: { kind: "uploaded", itemId: "i2", existing: {} } },
    { id: 4, name: "old.txt", state: { kind: "deleted" } },
    { id: 5, name: "new.pdf", state: { kind: "uploaded", itemId: "i3", folder: "Product" } },
  );
  act(() =>
    root.render(
      <MemoryRouter>
        <DataRoomDropZone userId="u1" />
      </MemoryRouter>,
    ),
  );
  const text = document.querySelector('[data-testid="data-room-toasts"]')?.textContent ?? "";
  expect(text).toContain("lease.pdfAlready in LegalView");
  expect(text).toContain("Already in Legal as lease.pdf");
  expect(text).toContain("notes.txtAlready in your Data roomView");
  // The outcome first, then the name.
  expect(text).toContain("Deletedold.txt");
  expect(text).toContain("Uploaded to ProductView");
});

const row = {
  id: "imp1",
  source: "upload",
  total: 12,
  done: 0,
  failed: 0,
  inProgress: 12,
  finished: false,
  added: 0,
  stage: "opening" as const,
  currentName: null,
  latest: [],
};

it("narrates a zip after the upload reaches 100 percent, then offers View", () => {
  const show = (state: UploadToast["state"]) => {
    toasts.length = 0;
    toasts.push({ id: 1, name: "q3.zip", state });
    act(() =>
      root.render(
        <MemoryRouter>
          <DataRoomDropZone userId="u1" />
        </MemoryRouter>,
      ),
    );
    return container.textContent ?? "";
  };
  expect(show({ kind: "uploading", fraction: 1 })).toContain("100%");
  expect(show({ kind: "importing", progress: null })).toContain("Opening q3.zip");
  expect(show({ kind: "importing", progress: { ...row, stage: "adding" } })).toContain(
    "Found 12 files",
  );
  expect(
    show({
      kind: "importing",
      progress: { ...row, stage: "adding", added: 5, currentName: "lease.pdf" },
    }),
  ).toContain("Adding 5 of 12 · lease.pdf");
  expect(
    show({ kind: "importing", progress: { ...row, stage: "done", added: 12, done: 7 } }),
  ).toContain("Reading 7 of 12");
  const done = show({ kind: "imported", count: 12 });
  expect(done).toContain("Added 12 files");
  expect(done).toContain("View");
});

it("bounds the toast stack so a batch scrolls instead of leaving the viewport", () => {
  toasts.push({ id: 1, name: "a.txt", state: { kind: "deleted" } });
  act(() =>
    root.render(
      <MemoryRouter>
        <DataRoomDropZone userId="u1" />
      </MemoryRouter>,
    ),
  );
  const stack = document.querySelector('[data-testid="data-room-toasts"]');
  expect(stack?.className).toContain("max-h-[calc(100dvh-14rem)]");
  expect(stack?.className).toContain("overflow-y-auto");
});
