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
  list: vi.fn(),
  get: vi.fn(),
  importEmail: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    connections: { list: rpcMock.connections, catalog: rpcMock.catalog },
    mcp: { servers: { list: async () => [] } },
    inbox: { list: rpcMock.list, get: rpcMock.get },
    dataRoom: { importEmail: rpcMock.importEmail },
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
const button = (name: string) =>
  Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent === name);

it("offers Connect Gmail, which opens the Gmail page, when no account is connected", async () => {
  await render([{ connectorId: "google", provider: "gmail", status: "pending" }]);
  expect(button("Import from email")).toBeUndefined();
  await click(button("Connect Gmail"));
  expect(document.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/gmail",
  );
});

it("imports the ticked attachment into the open folder", async () => {
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await click(button("Import from email"));
  expect(rpcMock.list).toHaveBeenCalledWith({ filter: "attachment" });
  expect(button("Import")?.disabled).toBe(true);
  await click(button("Invoicebilling@example.com"));
  await click(document.body.querySelector('[role="checkbox"]'));
  await click(button("Import"));
  expect(rpcMock.importEmail).toHaveBeenCalledWith({
    picks: [{ messageId: "m1", attachmentId: "a1" }],
    folderId: "f1",
  });
  expect(onDone).toHaveBeenCalledWith("Imported 1 file", true);
});

it("says so when everything picked was already imported", async () => {
  rpcMock.importEmail.mockResolvedValue({ imported: 0, duplicates: 1, failed: 0 });
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await click(button("Import from email"));
  await click(button("Invoicebilling@example.com"));
  await click(document.body.querySelector('[role="checkbox"]'));
  await click(button("Import"));
  expect(onDone).toHaveBeenCalledWith("Already in the Data room", true);
});

it("treats a Composio-style Gmail connection as connected", async () => {
  await render([{ connectorId: "composio", provider: " GMAIL ", status: "connected" }]);
  expect(button("Import from email")).toBeDefined();
});

it("keeps the picker open and says how many files failed", async () => {
  rpcMock.importEmail.mockResolvedValue({ imported: 1, duplicates: 0, failed: 2 });
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }]);
  await click(button("Import from email"));
  await click(button("Invoicebilling@example.com"));
  await click(document.body.querySelector('[role="checkbox"]'));
  await click(button("Import"));
  expect(onDone).toHaveBeenCalledWith("Imported 1 file", true);
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
  await click(button("Import from email"));
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
  await click(button("Import from email"));
  await click(button("Invoicebilling@example.com"));
  const boxes = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="checkbox"]'));
  for (const box of boxes().slice(0, 20)) await click(box);
  expect(
    boxes()[20]?.getAttribute("aria-disabled") ?? boxes()[20]?.hasAttribute("disabled"),
  ).toBeTruthy();
});

it("shows no Gmail button when the server does not offer Gmail and it is not connected", async () => {
  await render([], offers("googledrive"));
  expect(button("Connect Gmail")).toBeUndefined();
  expect(button("Import from email")).toBeUndefined();
  expect(button("Connect Google Drive")).toBeDefined();
});

it("keeps the Gmail button for a connected account even if the catalog omits it", async () => {
  await render([{ connectorId: "google", provider: "gmail", status: "connected" }], []);
  expect(button("Import from email")).toBeDefined();
});
