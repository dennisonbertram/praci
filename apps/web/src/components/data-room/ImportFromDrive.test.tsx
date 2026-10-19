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
  servers: vi.fn(),
  boxList: vi.fn(),
  importBox: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    connections: { list: rpcMock.connections, catalog: rpcMock.catalog },
    mcp: { servers: { list: rpcMock.servers } },
    dataRoom: {
      driveList: rpcMock.driveList,
      importDrive: rpcMock.importDrive,
      boxList: rpcMock.boxList,
      importBox: rpcMock.importBox,
    },
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
  rpcMock.servers.mockResolvedValue([]);
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
const box = (name: string) =>
  document.body.querySelector(`[role="checkbox"][aria-label="Select ${name}"]`);
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
  expect(box("Survey")?.hasAttribute("data-disabled")).toBe(true);
  await click(button("Contracts"));
  expect(rpcMock.driveList).toHaveBeenLastCalledWith({ folderId: "d1" });
  await click(box("inside.pdf"));
  await click(button("Import 1"));
  expect(rpcMock.importDrive).toHaveBeenCalledWith({
    fileIds: ["f2"],
    driveFolderIds: [],
    folderId: "room1",
  });
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
  await click(box("inside.pdf"));
  await click(button("Import 1"));
  expect(onDone).not.toHaveBeenCalled();
  expect(document.body.querySelector("[role=dialog]")).not.toBeNull();
});

it("reports files that failed, refreshes for the ones that arrived, and stays open", async () => {
  rpcMock.importDrive.mockResolvedValue({ imported: 1, duplicates: 0, failed: 2 });
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  await click(button("Contracts"));
  await click(box("inside.pdf"));
  await click(button("Import 1"));
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

const driveRoot = [
  { id: "d1", name: "Contracts", mimeType: "application/vnd.google-apps.folder", isFolder: true },
  file("f1", "Plan.pdf"),
];

it("shows a checkbox on hover and focus only, and keeps it visible once ticked", async () => {
  rpcMock.driveList.mockResolvedValue({ files: driveRoot });
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  const hidden = (name: string) => box(name)?.className.includes("opacity-0");
  expect(hidden("Plan.pdf")).toBe(true);
  expect(box("Plan.pdf")?.className).toContain("group-hover:opacity-100");
  expect(box("Plan.pdf")?.className).toContain("focus-visible:opacity-100");
  expect(box("Plan.pdf")?.className).toContain("data-checked:opacity-100");
  expect(box("Plan.pdf")?.className).toContain("hover:none");
  await click(box("Plan.pdf"));
  expect(box("Plan.pdf")?.hasAttribute("data-checked")).toBe(true);
});

it("keeps picks across folders, counts a folder as one, and sends files and folders apart", async () => {
  rpcMock.driveList.mockImplementation(async (input: { folderId?: string }) => ({
    files: input.folderId ? [file("f2", "inside.pdf")] : driveRoot,
  }));
  rpcMock.importDrive.mockResolvedValue({ imported: 0, duplicates: 0, failed: 0, queued: 2 });
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  expect(button("Import")?.hasAttribute("disabled")).toBe(true);
  await click(box("Plan.pdf"));
  // Ticking the folder's box does not open it.
  await click(box("Contracts"));
  expect(rpcMock.driveList).toHaveBeenCalledTimes(1);
  // Clicking the folder row does.
  await click(button("Contracts"));
  expect(rpcMock.driveList).toHaveBeenLastCalledWith({ folderId: "d1" });
  await click(box("inside.pdf"));
  expect(button("Import 3")).toBeDefined();
  await click(button("Back"));
  expect(box("Contracts")?.hasAttribute("data-checked")).toBe(true);
  await click(button("Import 3"));
  expect(rpcMock.importDrive).toHaveBeenCalledWith({
    fileIds: ["f1", "f2"],
    driveFolderIds: ["d1"],
    folderId: "room1",
  });
  // Folder files arrive in the background, so the list refreshes without a message.
  expect(onDone).toHaveBeenCalledWith("", true);
});

it("keeps refreshing the Data room for two minutes after a folder import, and counts an empty folder as a change", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.driveList.mockResolvedValue({ files: driveRoot });
    rpcMock.importDrive.mockResolvedValue({
      imported: 0,
      duplicates: 0,
      failed: 0,
      queued: 0,
      folders: 1,
    });
    const changed = vi.fn();
    window.addEventListener("rakazo:data-room-changed", changed);
    await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
    await click(button("Import from Google Drive"));
    await click(box("Contracts"));
    await click(button("Import 1"));
    // An empty Drive folder queues no files but still creates a folder.
    expect(onDone).toHaveBeenCalledWith("", true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(changed).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(117_000);
    });
    expect(changed).toHaveBeenCalledTimes(40);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(changed).toHaveBeenCalledTimes(40);
    window.removeEventListener("rakazo:data-room-changed", changed);
  } finally {
    vi.useRealTimers();
  }
});

it("does not keep refreshing after a plain file import", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.driveList.mockResolvedValue({ files: driveRoot });
    const changed = vi.fn();
    window.addEventListener("rakazo:data-room-changed", changed);
    await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
    await click(button("Import from Google Drive"));
    await click(box("Plan.pdf"));
    await click(button("Import 1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(changed).not.toHaveBeenCalled();
    window.removeEventListener("rakazo:data-room-changed", changed);
  } finally {
    vi.useRealTimers();
  }
});

it("shows the server's over-limit error and stays open", async () => {
  rpcMock.driveList.mockResolvedValue({ files: driveRoot });
  rpcMock.importDrive.mockRejectedValue(
    Object.assign(new Error("Folder imports are limited to 500 files."), { code: "BAD_REQUEST" }),
  );
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await click(button("Import from Google Drive"));
  await click(box("Contracts"));
  await click(button("Import 1"));
  expect(document.body.textContent).toContain("Folder imports are limited to 500 files.");
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

const boxServer = { id: "s1", name: "Box", endpoint: "https://mcp.box.com" };

it("shows no Box button until a Box connection exists", async () => {
  await render([]);
  expect(button("Import from Box")).toBeUndefined();
});

it("imports ticked Box files and folders through the Box endpoints, into the open folder", async () => {
  rpcMock.servers.mockResolvedValue([
    boxServer,
    { id: "s2", name: "Other", endpoint: "https://x.test/mcp" },
  ]);
  rpcMock.boxList.mockResolvedValue({
    files: [
      { id: "10", name: "Deals", mimeType: "", isFolder: true },
      { id: "20", name: "memo.pdf", mimeType: "", isFolder: false, size: 10 },
    ],
  });
  rpcMock.importBox.mockResolvedValue({
    imported: 1,
    duplicates: 0,
    failed: 0,
    queued: 3,
    folders: 2,
  });
  await render([]);
  await click(button("Import from Box"));
  expect(document.body.textContent).toContain("Import from Box");
  await click(box("Deals"));
  await click(box("memo.pdf"));
  await click(button("Import 2"));
  expect(rpcMock.importBox).toHaveBeenCalledWith({
    fileIds: ["20"],
    boxFolderIds: ["10"],
    folderId: "room1",
  });
  expect(rpcMock.importDrive).not.toHaveBeenCalled();
});

it("shows the reconnect error when Box refuses the sign-in", async () => {
  rpcMock.servers.mockResolvedValue([boxServer]);
  rpcMock.boxList.mockRejectedValue(new Error("The Box account needs to be reconnected"));
  await render([]);
  await click(button("Import from Box"));
  expect(document.body.textContent).toContain("reconnected");
});
