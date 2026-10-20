// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
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
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
let search = "";
const Where = () => {
  search = useLocation().search;
  return null;
};
const show = async (url = "/app/contacts") => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <ContactsPage />
        <Where />
      </MemoryRouter>,
    ),
  );
  await flush();
};
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === label);
const click = (el: Element | undefined) =>
  act(async () => (el as HTMLElement | undefined)?.click());
const typeInto = (input: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

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

it("finds a contact by its notes or its kind label", async () => {
  rpcMock.list.mockResolvedValue([
    { ...contact("c1", "Ada", "legal"), email: null, organization: null, notes: "Outside counsel" },
    contact("c2", "Bo", "vendor"),
  ]);
  await show();
  const search = container.querySelector('input[type="search"]') as HTMLInputElement;
  await typeInto(search, "counsel");
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).not.toContain("Bo");
  await typeInto(search, "vendor");
  expect(container.textContent).toContain("Bo");
  expect(container.textContent).not.toContain("Ada");
});

it("keeps search and kind in the URL, and No matches clears both", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "customer"), contact("c2", "Bo", "vendor")]);
  await show("/app/contacts?q=ada&kind=customer");
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).not.toContain("Bo");
  const field = container.querySelector('input[type="search"]') as HTMLInputElement;
  expect(field.value).toBe("ada");
  await typeInto(field, "zzz");
  expect(search).toBe("?q=zzz&kind=customer");
  expect(container.textContent).toContain("No matches");
  await click(button("Clear filters"));
  expect(search).toBe("");
  expect(container.textContent).toContain("Bo");
});

it("retries the load from the error", async () => {
  rpcMock.list
    .mockRejectedValueOnce(new Error("boom"))
    .mockResolvedValue([contact("c1", "Ada", "other")]);
  await show();
  await click(button("Try again"));
  expect(container.textContent).toContain("Ada");
  expect(container.querySelector("[role=alert]")).toBeNull();
});

it("deletes with an Undo that restores, and marks the saved row", async () => {
  const ada = contact("c1", "Ada", "other");
  rpcMock.list.mockResolvedValue([ada]);
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockResolvedValue({ ...ada, id: "c9" });
  await show();
  await click(container.querySelector("tbody button") as HTMLElement);
  await click(button("Delete"));
  expect(document.body.textContent).toContain("Deleted Ada");
  await click(button("Undo"));
  expect(rpcMock.save).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Ada", kind: "other" }),
  );
  expect(document.body.textContent).toContain("Restored Ada");
});

it("starts a new contact with the kind filter's kind and no Carta hint", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "vendor")]);
  rpcMock.save.mockResolvedValue(contact("c2", "Cy", "vendor"));
  await show("/app/contacts?kind=vendor");
  await click(button("Add contact"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("vendor");
  expect(document.body.textContent).not.toContain("Carta");
  await typeInto(document.getElementById("contact-name") as HTMLInputElement, "Cy");
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Cy", kind: "vendor" }),
  );
});

it("sends null when Notes is cleared, and names the agent that added the contact", async () => {
  const ada = {
    ...contact("c1", "Ada", "legal"),
    notes: "Old note",
    addedBy: { id: "b1", name: "Chief" },
  };
  rpcMock.list.mockResolvedValue([ada]);
  rpcMock.save.mockResolvedValue(ada);
  await show();
  await click(container.querySelector("tbody button") as HTMLElement);
  expect(document.body.textContent).toContain("Added by Chief");
  await typeInto(document.getElementById("contact-notes") as HTMLTextAreaElement, "");
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", notes: null }));
});
