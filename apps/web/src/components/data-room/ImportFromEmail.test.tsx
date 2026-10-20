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
  servers: vi.fn(async (): Promise<unknown[]> => []),
  catalog: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  importEmail: vi.fn(),
  imported: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    connections: { list: rpcMock.connections, catalog: rpcMock.catalog },
    mcp: { servers: { list: rpcMock.servers } },
    inbox: { list: rpcMock.list, get: rpcMock.get },
    dataRoom: { importEmail: rpcMock.importEmail, emailImported: rpcMock.imported },
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

beforeEach(() => {
  rpcMock.list.mockResolvedValue({
    accounts: [{ id: "c1" }],
    failedAccounts: [],
    reconnectAccounts: [],
    rows: [{ id: "m1", subject: "Invoice", from: "billing@example.com" }],
  });
  rpcMock.get.mockResolvedValue({
    attachments: [{ id: "a1", filename: "invoice.pdf", mimeType: "application/pdf", size: 2000 }],
  });
  rpcMock.importEmail.mockResolvedValue({ imported: 1, duplicates: 0, failed: 0 });
  rpcMock.imported.mockResolvedValue({ files: [] });
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

async function render(connections: unknown[], catalog = offers("gmail", "googledrive")) {
  rpcMock.connections.mockResolvedValue(connections);
  rpcMock.catalog.mockResolvedValue(catalog);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ImportSources folderId="f1" onDone={onDone} />
        <Where />
      </MemoryRouter>,
    );
  });
}

const click = (el: Element | null | undefined) =>
  act(async () => {
    (el as HTMLElement).click();
  });
const fileBox = (name: string) => document.body.querySelector(`[aria-label="Select ${name}"]`);
const settle = () => act(async () => {});
const button = (name: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>("button:not([aria-haspopup])")).find(
    (b) => b.textContent === name,
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

it("lists Email, Google Drive and Box in one Import menu", async () => {
  rpcMock.servers.mockResolvedValue([{ id: "s1", name: "Box", endpoint: "https://mcp.box.com" }]);
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  expect(button("Import from email")).toBeUndefined();
  expect(await menuItems()).toEqual(["Email", "Google Drive", "Box"]);
});

it("moves through the menu with the keyboard and opens the focused item", async () => {
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  const trigger = document.querySelector<HTMLElement>('[aria-haspopup="menu"]');
  expect(trigger?.textContent).toBe("Import");
  await act(async () => trigger?.focus());
  await act(async () => {
    trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  const first = item("Email") as HTMLElement;
  expect(document.activeElement).toBe(first);
  await act(async () => {
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    first.click();
  });
  await settle();
  expect(rpcMock.list).toHaveBeenCalled();
});

it("sends a not connected Email item to the Gmail page", async () => {
  await render([{ connectorId: "google", provider: "gmail", status: "pending" }]);
  await choose("Email");
  expect(document.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/gmail",
  );
});

it("imports the ticked attachment into the open folder", async () => {
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await choose("Email");
  expect(rpcMock.list).toHaveBeenCalledWith({ filter: "attachment" });
  expect(button("Import")?.disabled).toBe(true);
  expect(button("Import 1 file")).toBeUndefined();
  await click(fileBox("invoice.pdf"));
  expect(button("Import 1 file")?.disabled).toBe(false);
  await click(button("Import 1 file"));
  expect(rpcMock.importEmail).toHaveBeenCalledWith({
    picks: [{ messageId: "m1", attachmentId: "a1" }],
    folderId: "f1",
  });
  expect(onDone).toHaveBeenCalledWith("", true);
});

it("says so when everything picked was already imported", async () => {
  rpcMock.importEmail.mockResolvedValue({ imported: 0, duplicates: 1, failed: 0 });
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await choose("Email");
  await click(fileBox("invoice.pdf"));
  await click(button("Import 1 file"));
  expect(onDone).toHaveBeenCalledWith("Already in the Data room", true);
});

it("treats a Composio-style Gmail connection as connected", async () => {
  await render([{ connectorId: "composio", provider: " GMAIL ", status: "connected" }]);
  expect(await menuItems()).toContain("Email");
});

it("keeps the picker open and says how many files failed", async () => {
  rpcMock.importEmail.mockResolvedValue({ imported: 1, duplicates: 0, failed: 2 });
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await choose("Email");
  await click(fileBox("invoice.pdf"));
  await click(button("Import 1 file"));
  expect(onDone).toHaveBeenCalledWith("", true);
  expect(document.body.textContent).toContain("Couldn't import 2 files");
});

it("shows a mail error instead of an empty list, with a reconnect link", async () => {
  rpcMock.list.mockResolvedValue({
    accounts: [{ id: "c1" }],
    failedAccounts: ["c1"],
    reconnectAccounts: ["c1"],
    rows: [],
  });
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await choose("Email");
  expect(document.body.textContent).toContain("Gmail needs to be reconnected.");
  expect(document.body.textContent).not.toContain("No files found");
  expect(
    document.body.querySelector('a[href="/app/integrations/app/google/gmail"]'),
  ).not.toBeNull();
});

it("stops offering unticked boxes once 20 files are picked", async () => {
  rpcMock.get.mockResolvedValue({
    attachments: Array.from({ length: 21 }, (_, n) => ({
      id: `a${n}`,
      filename: `f${n}.pdf`,
      mimeType: "application/pdf",
      size: 1,
    })),
  });
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await choose("Email");
  const boxes = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="checkbox"]')).slice(1);
  for (const box of boxes().slice(0, 20)) await click(box);
  expect(
    boxes()[20]?.getAttribute("aria-disabled") ?? boxes()[20]?.hasAttribute("disabled"),
  ).toBeTruthy();
});

it("leaves Email out of the menu when the server does not offer Gmail and it is not connected", async () => {
  await render([], offers("googledrive"));
  expect(await menuItems()).toEqual(["Google Drive", "Box"]);
});

it("keeps Email for a connected account even if the catalog omits it", async () => {
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }], []);
  expect(await menuItems()).toContain("Email");
});

const gmailConnected = [{ connectorId: "google", provider: "gmail", status: "connected" }];
const file = (id: string, filename: string, mimeType = "application/pdf", size = 20_000) => ({
  id,
  filename,
  mimeType,
  size,
});

it("lists only messages that carry real documents, leaving out signature pictures", async () => {
  rpcMock.list.mockResolvedValue({
    accounts: [{ id: "c1" }],
    failedAccounts: [],
    reconnectAccounts: [],
    rows: [
      { id: "m1", subject: "Invoice", from: "a@example.com", receivedAt: "2026-10-10T00:00:00Z" },
      {
        id: "m2",
        subject: "Just a logo",
        from: "b@example.com",
        receivedAt: "2026-10-09T00:00:00Z",
      },
    ],
  });
  rpcMock.get.mockImplementation(async ({ messageId }: { messageId: string }) => ({
    attachments:
      messageId === "m1"
        ? [file("a1", "invoice.pdf"), file("a2", "image001.png", "image/png", 50_000)]
        : [file("b1", "tiny.png", "image/png", 800)],
  }));
  await render(gmailConnected);
  await choose("Email");
  expect(document.body.textContent).toContain("Invoice");
  expect(document.body.textContent).not.toContain("Just a logo");
  expect(fileBox("invoice.pdf")).not.toBeNull();
  expect(fileBox("image001.png")).toBeNull();
});

it("selects every file of a message from the message checkbox", async () => {
  rpcMock.get.mockResolvedValue({ attachments: [file("a1", "a.pdf"), file("a2", "b.pdf")] });
  await render(gmailConnected);
  await choose("Email");
  await click(document.body.querySelector('[aria-label="Select Invoice"]'));
  expect(button("Import 2 files")).toBeDefined();
  await click(button("Import 2 files"));
  expect(rpcMock.importEmail).toHaveBeenCalledWith({
    picks: [
      { messageId: "m1", attachmentId: "a1" },
      { messageId: "m1", attachmentId: "a2" },
    ],
    folderId: "f1",
  });
});

it("marks files already in the Data room as ticked and cannot be changed", async () => {
  rpcMock.get.mockResolvedValue({ attachments: [file("a1", "a.pdf"), file("a2", "b.pdf")] });
  rpcMock.imported.mockResolvedValue({ files: [{ messageId: "m1", attachmentId: "a1" }] });
  await render(gmailConnected);
  await choose("Email");
  expect(rpcMock.imported).toHaveBeenCalledWith({ messageIds: ["m1"] });
  expect(document.body.textContent).toContain("In Data room");
  const done = fileBox("a.pdf") as HTMLElement;
  expect(done.getAttribute("aria-checked")).toBe("true");
  expect(done.hasAttribute("disabled") || done.getAttribute("aria-disabled") === "true").toBe(true);
  await click(document.body.querySelector('[aria-label="Select Invoice"]'));
  expect(button("Import 1 file")).toBeDefined();
});

it("shows the empty state when no message has documents", async () => {
  rpcMock.list.mockResolvedValue({
    accounts: [{ id: "c1" }],
    failedAccounts: [],
    reconnectAccounts: [],
    rows: [],
  });
  await render(gmailConnected);
  await choose("Email");
  await settle();
  expect(document.body.textContent).toContain("No files found");
  expect(document.body.textContent).not.toContain("Loading…");
});

it("shows the loading text while mail loads", async () => {
  rpcMock.list.mockReturnValue(new Promise(() => undefined));
  await render(gmailConnected);
  await choose("Email");
  expect(document.body.textContent).toContain("Loading…");
});

it("shows an error when mail cannot be loaded", async () => {
  rpcMock.list.mockRejectedValue(new Error("boom"));
  await render(gmailConnected);
  await choose("Email");
  expect(document.body.querySelector(".text-destructive")).not.toBeNull();
  expect(document.body.textContent).not.toContain("No files found");
});
