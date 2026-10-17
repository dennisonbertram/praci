// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
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
});
