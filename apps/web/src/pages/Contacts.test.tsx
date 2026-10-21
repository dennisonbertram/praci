// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
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
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock("../lib/rpc", () => ({
  rpc: { contacts: { list: rpcMock.list, save: rpcMock.save, delete: rpcMock.remove } },
}));

import { ContactsPage } from "./Contacts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const contact = (id: string, name: string, kind: Contact["kind"]): Contact => ({
  id,
  name,
  email: `${name.toLowerCase()}@example.test`,
  organization: "Acme Corp",
  kind,
  notes: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const show = async () => {
  await act(async () => root.render(<ContactsPage />));
  await flush();
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("lists contacts, searches them and filters by kind", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "customer"), contact("c2", "Bo", "vendor")]);
  await show();
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).toContain("Bo");
  expect(container.textContent).toContain("Customer");

  const search = container.querySelector('input[type="search"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "bo@");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).not.toContain("Ada");
  expect(container.textContent).toContain("Bo");

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "zzz");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).toContain("No matches");
});

it("keeps rows short and names the workspace when there is more than one", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await act(async () => root.render(<ContactsPage spaceName="Example Co" />));
  await act(async () => {});
  expect(container.querySelector("h1")?.parentElement?.textContent).toContain("Example Co");
  expect(container.querySelector("tbody tr")?.className).toContain("h-10");
});

it("shows a single line when there are no contacts", async () => {
  rpcMock.list.mockResolvedValueOnce([]);
  await show();
  expect(container.textContent).toContain("No contacts yet");
  expect(container.querySelector("table")).toBeNull();
});

it("shows an alert when contacts cannot be loaded", async () => {
  rpcMock.list.mockRejectedValue(new Error("boom"));
  await show();
  expect(container.querySelector("[role=alert]")).not.toBeNull();
});

const click = (el: Element | null | undefined) => act(async () => (el as HTMLElement)?.click());
const buttonNamed = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === label);

it("shows Saved on add, and starts a new contact as an investor like Cap table", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "customer")]);
  rpcMock.save.mockResolvedValue(contact("c2", "Bo", "investor"));
  await show();
  await click(buttonNamed("Add contact"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("investor");
  const name = document.getElementById("contact-name") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(name, "Bo");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(name.closest("form")?.querySelector("button[type=submit]"));
  expect(container.querySelector("[role=status]")?.textContent).toContain("Saved Bo");
});

it("shows Deleted with Undo, and the organisation under the name", async () => {
  const ada = contact("c1", "Ada", "customer");
  rpcMock.list.mockResolvedValue([ada]);
  rpcMock.remove.mockResolvedValue(undefined);
  rpcMock.save.mockResolvedValue(ada);
  await show();
  expect(container.querySelector("tbody td div")?.textContent).toBe("Acme Corp");
  await click(container.querySelector("tbody button"));
  await click(buttonNamed("Delete"));
  await click(buttonNamed("Delete"));
  const notice = container.querySelector("[role=status]")?.textContent ?? "";
  expect(notice).toContain("Deleted Ada");
  expect(notice).toContain("Undo");
});
