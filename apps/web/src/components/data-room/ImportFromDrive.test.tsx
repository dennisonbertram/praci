// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
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

const rpcMock = vi.hoisted(() => ({
  connections: vi.fn(),
  catalog: vi.fn(),
  driveList: vi.fn(),
  importDrive: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    connections: { list: rpcMock.connections, catalog: rpcMock.catalog },
    dataRoom: { driveList: rpcMock.driveList, importDrive: rpcMock.importDrive },
  },
}));

import { ImportSources } from "./ImportFromEmail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onDone = vi.fn();

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

const file = (id: string, name: string, extra = {}) => ({
  id,
  name,
  mimeType: "application/pdf",
  isFolder: false,
  ...extra,
});

beforeEach(() => {
  rpcMock.driveList.mockImplementation(async (input: { folderId?: string }) => ({
    files: input.folderId
      ? [file("f2", "inside.pdf", { size: 2000 })]
      : [
          {
            id: "d1",
            name: "Contracts",
            mimeType: "application/vnd.google-apps.folder",
            isFolder: true,
          },
          file("f1", "Survey", { mimeType: "application/vnd.google-apps.form" }),
        ],
  }));
  rpcMock.importDrive.mockResolvedValue({ imported: 1, duplicates: 0, failed: 0 });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const offers = (...slugs: string[]) => slugs.map((slug) => ({ connectorId: "google", slug }));

async function render(
  connections: unknown[],
  catalog: unknown[] | Error = offers("gmail", "googledrive"),
) {
  rpcMock.connections.mockResolvedValue(connections);
  if (catalog instanceof Error) rpcMock.catalog.mockRejectedValue(catalog);
  else rpcMock.catalog.mockResolvedValue(catalog);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ImportSources folderId="room1" onDone={onDone} />
        <Where />
      </MemoryRouter>,
    );
  });
}

const click = (el: Element | null | undefined) =>
  act(async () => {
    (el as HTMLElement).click();
  });
const button = (name: string) =>
  Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );

it("offers Connect Google Drive, which opens the Drive page, when no account is connected", async () => {
  await render([{ connectorId: "google", provider: "googledrive", status: "pending" }]);
  expect(button("Import from Google Drive")).toBeUndefined();
  await click(button("Connect Google Drive"));
  expect(document.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/googledrive",
  );
});

it("opens a folder, imports its file into the open folder, and can go back", async () => {
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  expect(rpcMock.driveList).toHaveBeenCalledWith({});
  // A Google Form cannot be imported.
  expect(document.body.querySelector('[role="checkbox"]')?.hasAttribute("data-disabled")).toBe(
    true,
  );
  await click(button("Contracts"));
  expect(rpcMock.driveList).toHaveBeenLastCalledWith({ folderId: "d1" });
  await click(document.body.querySelector('[role="checkbox"]'));
  await click(button("Import"));
  expect(rpcMock.importDrive).toHaveBeenCalledWith({ fileIds: ["f2"], folderId: "room1" });
  expect(onDone).toHaveBeenCalledWith("Imported 1 file", true);
});

it("goes back up from a folder", async () => {
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  await click(button("Contracts"));
  await click(button("Back"));
  expect(rpcMock.driveList).toHaveBeenLastCalledWith({});
});

it("shows the error when the import fails", async () => {
  rpcMock.importDrive.mockRejectedValue(new Error("Drive down"));
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  await click(button("Contracts"));
  await click(document.body.querySelector('[role="checkbox"]'));
  await click(button("Import"));
  expect(onDone).not.toHaveBeenCalled();
  expect(document.body.querySelector("[role=dialog]")).not.toBeNull();
});

it("reports files that failed, refreshes for the ones that arrived, and stays open", async () => {
  rpcMock.importDrive.mockResolvedValue({ imported: 1, duplicates: 0, failed: 2 });
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  await click(button("Contracts"));
  await click(document.body.querySelector('[role="checkbox"]'));
  await click(button("Import"));
  expect(onDone).toHaveBeenCalledWith("Imported 1 file", true);
  expect(document.body.textContent).toContain("Couldn't import 2 files");
});

it("stops offering more files after 20 are ticked", async () => {
  rpcMock.driveList.mockResolvedValue({
    files: Array.from({ length: 21 }, (_, i) => file(`f${i}`, `file${i}.pdf`)),
  });
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  const boxes = () => Array.from(document.body.querySelectorAll('[role="checkbox"]'));
  for (const box of boxes().slice(0, 20)) await click(box);
  expect(boxes()[20]?.hasAttribute("data-disabled")).toBe(true);
});

it("shows no Drive button when the server does not offer Drive and it is not connected", async () => {
  await render(
    [{ connectorId: "google", provider: "googledrive", status: "pending" }],
    offers("gmail"),
  );
  expect(button("Connect Google Drive")).toBeUndefined();
  expect(button("Import from Google Drive")).toBeUndefined();
  // Gmail is still offered, so the other button stays.
  expect(button("Connect Gmail")).toBeDefined();
});

it("shows no Drive button when the catalog cannot be read", async () => {
  await render([], new Error("no catalog"));
  expect(button("Connect Google Drive")).toBeUndefined();
});
