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

import { DrivePicker } from "./ImportFromDrive";
import { ImportSources } from "./ImportFromEmail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onDone = vi.fn();

function Where() {
  const { pathname, search } = useLocation();
  return (
    <>
      <span data-testid="where">{pathname}</span>
      <span data-testid="search">{search}</span>
    </>
  );
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
      <MemoryRouter initialEntries={["/app/data-room"]}>
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
  Array.from(document.body.querySelectorAll("button:not([aria-haspopup])")).find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );

const item = (name: string) =>
  Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
    (el) => el.textContent === name,
  );
/** Opens the Import menu and lists its items. */
const menuItems = async () => {
  await click(document.querySelector('[aria-haspopup="menu"]'));
  return Array.from(document.body.querySelectorAll('[role="menuitem"]')).map(
    (el) => el.textContent,
  );
};
/** Opens the Import menu, then picks one source. */
const choose = async (name: string) => {
  await click(document.querySelector('[aria-haspopup="menu"]'));
  await click(item(name));
};

it("sends a not connected Google Drive item to the Drive page", async () => {
  await render([{ connectorId: "google", provider: "googledrive", status: "pending" }]);
  await choose("From Google Drive");
  expect(document.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/googledrive",
  );
});

it("opens a folder, imports its file into the open folder, and can go back", async () => {
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await choose("From Google Drive");
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
  await choose("From Google Drive");
  await click(button("Contracts"));
  await click(button("Back"));
  expect(rpcMock.driveList).toHaveBeenLastCalledWith({});
});

it("shows the error when the import fails", async () => {
  rpcMock.importDrive.mockRejectedValue(new Error("Drive down"));
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await choose("From Google Drive");
  await click(button("Contracts"));
  await click(box("inside.pdf"));
  await click(button("Import 1"));
  expect(onDone).not.toHaveBeenCalled();
  expect(document.body.querySelector("[role=dialog]")).not.toBeNull();
});

it("reports files that failed, refreshes for the ones that arrived, and stays open", async () => {
  rpcMock.importDrive.mockResolvedValue({ imported: 1, duplicates: 0, failed: 2 });
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await choose("From Google Drive");
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
  await choose("From Google Drive");
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
  await choose("From Google Drive");
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
  await choose("From Google Drive");
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
  // Folder files arrive in the background: the notice says how many, and the list refreshes.
  expect(onDone).toHaveBeenCalledWith("Importing 2 files", true);
});

it("says how many files are importing, tells the page an import started, and counts an empty folder as a change", async () => {
  rpcMock.driveList.mockResolvedValue({ files: driveRoot });
  const started = vi.fn();
  window.addEventListener("rakazo:data-room-import-started", started);
  try {
    rpcMock.importDrive.mockResolvedValue({
      imported: 0,
      duplicates: 0,
      failed: 0,
      queued: 5,
      folders: 2,
      importId: "imp1",
      total: 5,
    });
    await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
    await choose("From Google Drive");
    await click(box("Contracts"));
    await click(button("Import 1"));
    expect(onDone).toHaveBeenCalledWith("Importing 5 files", true);
    expect(started).toHaveBeenCalledTimes(1);

    // A folder with no files still creates a folder, and says nothing.
    onDone.mockClear();
    rpcMock.importDrive.mockResolvedValue({
      imported: 0,
      duplicates: 0,
      failed: 0,
      queued: 0,
      folders: 1,
      importId: "imp2",
      total: 0,
    });
    await choose("From Google Drive");
    await click(box("Contracts"));
    await click(button("Import 1"));
    expect(onDone).toHaveBeenCalledWith("", true);
  } finally {
    window.removeEventListener("rakazo:data-room-import-started", started);
  }
});

it("shows the server's over-limit error and stays open", async () => {
  rpcMock.driveList.mockResolvedValue({ files: driveRoot });
  rpcMock.importDrive.mockRejectedValue(
    Object.assign(new Error("Folder imports are limited to 500 files."), { code: "BAD_REQUEST" }),
  );
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await choose("From Google Drive");
  await click(box("Contracts"));
  await click(button("Import 1"));
  expect(document.body.textContent).toContain("Folder imports are limited to 500 files.");
});

it("leaves Google Drive out of the menu when the server does not offer Drive and it is not connected", async () => {
  await render(
    [{ connectorId: "google", provider: "googledrive", status: "pending" }],
    offers("gmail"),
  );
  // Email is still offered, so its item stays.
  expect(await menuItems()).toEqual(["From email", "From Box"]);
});

it("leaves Google Drive out of the menu when the catalog cannot be read", async () => {
  await render([], new Error("no catalog"));
  expect(await menuItems()).toEqual(["From Box"]);
});

const boxServer = { id: "s1", name: "Box", endpoint: "https://mcp.box.com" };

it("sends a not connected Box item to the Box connect dialog", async () => {
  await render([]);
  await choose("From Box");
  expect(rpcMock.boxList).not.toHaveBeenCalled();
  expect(document.querySelector('[data-testid="where"]')?.textContent).toBe("/app/integrations");
  expect(document.querySelector('[data-testid="search"]')?.textContent).toBe("?connect=box");
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
  await choose("From Box");
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

const reconnectLink = () =>
  Array.from(document.body.querySelectorAll("a")).find((a) => a.textContent === "Reconnect");

it("offers Reconnect when Box refuses the sign-in, and returns to the Data room afterwards", async () => {
  rpcMock.servers.mockResolvedValue([boxServer]);
  rpcMock.boxList.mockRejectedValue(new Error("The Box account needs to be reconnected"));
  await render([]);
  await choose("From Box");
  expect(document.body.textContent).toContain("needs to be reconnected");
  await click(reconnectLink());
  expect(document.querySelector('[data-testid="where"]')?.textContent).toBe("/app/integrations");
  expect(document.querySelector('[data-testid="search"]')?.textContent).toBe(
    "?connect=box&returnTo=%2Fapp%2Fdata-room",
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("offers Reconnect to the Drive page when Drive refuses the sign-in", async () => {
  rpcMock.driveList.mockRejectedValue(new Error("The Drive account needs to be reconnected"));
  await render([{ connectorId: "google", provider: "googledrive", status: "connected" }]);
  await choose("From Google Drive");
  await click(reconnectLink());
  expect(document.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/googledrive",
  );
  expect(document.querySelector('[data-testid="search"]')?.textContent).toBe(
    "?next=%2Fapp%2Fdata-room",
  );
});

it("shows other Box errors without a Reconnect link", async () => {
  rpcMock.servers.mockResolvedValue([boxServer]);
  rpcMock.boxList.mockRejectedValue(new Error("Box rate limit reached; try again later"));
  await render([]);
  await choose("From Box");
  expect(document.body.textContent).toContain("rate limit");
  expect(reconnectLink()).toBeUndefined();
});

const spreadsheet = "application/vnd.google-apps.spreadsheet";

it("in single-sheet mode returns the chosen sheet and imports nothing", async () => {
  rpcMock.driveList.mockResolvedValue({
    files: [
      {
        id: "d1",
        name: "Contracts",
        mimeType: "application/vnd.google-apps.folder",
        isFolder: true,
      },
      file("s1", "Cap table", { mimeType: spreadsheet }),
      file("s2", "Other sheet", { mimeType: spreadsheet }),
      file("f1", "Plan.pdf"),
    ],
  });
  const onPickSheet = vi.fn();
  await act(async () => {
    root.render(
      <MemoryRouter>
        <DrivePicker reconnectPath="/x" onClose={vi.fn()} onPickSheet={onPickSheet} />
      </MemoryRouter>,
    );
  });
  // Only a Google Sheet can be chosen: not a folder, not a PDF.
  expect(box("Plan.pdf")?.hasAttribute("data-disabled")).toBe(true);
  expect(box("Contracts")?.hasAttribute("data-disabled")).toBe(true);
  expect(button("Use this sheet")?.hasAttribute("disabled")).toBe(true);
  // One sheet at a time: ticking a second replaces the first.
  await click(box("Cap table"));
  await click(box("Other sheet"));
  expect(box("Cap table")?.hasAttribute("data-checked")).toBe(false);
  await click(box("Cap table"));
  await click(button("Use this sheet"));
  expect(onPickSheet).toHaveBeenCalledWith({ id: "s1", name: "Cap table" });
  expect(rpcMock.importDrive).not.toHaveBeenCalled();
});
