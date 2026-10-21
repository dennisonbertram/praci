// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
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
        <NotificationToaster onOpen={() => {}} />
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
  act(() => notificationToastManager.close());
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

it("names the workspace when there is more than one", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/contacts"]}>
        <ContactsPage spaceName="Example Co" />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  expect(container.querySelector("h1")?.parentElement?.textContent).toContain("Example Co");
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

it("editing the Email clears a duplicate-email error", async () => {
  const ada = contact("c1", "Ada", "other");
  const cy = contact("c2", "Cy", "vendor");
  rpcMock.list.mockResolvedValue([ada, cy]);
  rpcMock.save.mockRejectedValue(new Error("Another contact already has this email."));
  await show();
  await click(container.querySelector("tbody button") as HTMLElement);
  await typeInto(document.getElementById("contact-email") as HTMLInputElement, "cy@example.test");
  await click(button("Save"));
  expect(document.body.textContent).toContain("Another contact already has this email.");
  expect(button("Open Cy")).toBeDefined();
  await typeInto(document.getElementById("contact-email") as HTMLInputElement, "cy2@example.test");
  expect(document.body.textContent).not.toContain("Another contact already has this email.");
});

it("opens a contact from any cell of its row", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  await show();
  await click(container.querySelector("tbody td:nth-child(3)") as HTMLElement);
  expect(document.getElementById("contact-name")).not.toBeNull();
});

it("focuses Search after Clear filters", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  await show("/app/contacts?q=zzz");
  await click(button("Clear filters"));
  expect(document.activeElement).toBe(container.querySelector("input[name=contacts-search]"));
});

it("focuses the restored contact's name after Undo", async () => {
  const ada = contact("c1", "Ada", "other");
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockResolvedValue({ ...ada, id: "c9" });
  rpcMock.list.mockResolvedValue([ada]);
  await show();
  await click(container.querySelector("tbody button") as HTMLElement);
  await click(button("Delete"));
  rpcMock.list.mockResolvedValue([{ ...ada, id: "c9" }]);
  await click(button("Undo"));
  await flush();
  expect(document.activeElement?.textContent).toBe("Ada");
  expect(document.activeElement?.closest("tr")?.getAttribute("data-contact-id")).toBe("c9");
});

it.each(["not an email", "name@example..com"])(
  "reports the invalid email %s under the field and focuses it, without saving",
  async (bad) => {
    rpcMock.list.mockResolvedValue([]);
    await show();
    await click(button("Add contact"));
    await typeInto(document.getElementById("contact-name") as HTMLInputElement, "Cy");
    const email = document.getElementById("contact-email") as HTMLInputElement;
    await typeInto(email, bad);
    await click(button("Save"));
    expect(rpcMock.save).not.toHaveBeenCalled();
    expect(email.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(email.getAttribute("aria-describedby") ?? "");
    expect(message?.textContent).toBe("Enter a valid email");
    expect(document.activeElement).toBe(email);
    await typeInto(email, "cy@example.test");
    expect(email.getAttribute("aria-invalid")).toBeNull();
  },
);

it("marks the Email invalid and focuses it when another contact has it", async () => {
  const cy = contact("c2", "Cy", "vendor");
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other"), cy]);
  rpcMock.save.mockRejectedValue(new Error("Another contact already has this email."));
  await show();
  await click(container.querySelector("tbody button") as HTMLElement);
  const email = document.getElementById("contact-email") as HTMLInputElement;
  await typeInto(email, "cy@example.test");
  await click(button("Save"));
  expect(email.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(email.getAttribute("aria-describedby") ?? "")?.textContent,
  ).toContain("Another contact already has this email.");
  expect(document.activeElement).toBe(email);
});

it("shows the organization, else the email, under the name", async () => {
  rpcMock.list.mockResolvedValue([
    contact("c1", "Ada", "customer"),
    { ...contact("c3", "Cy", "vendor"), organization: null },
  ]);
  await show();
  const under = [...container.querySelectorAll("tbody td:first-child div")].map(
    (div) => div.textContent,
  );
  expect(under).toEqual(["Acme Corp", "cy@example.test"]);
});

it("lets the table fill the page and titles a long email", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "customer")]);
  await show();
  const email = [...container.querySelectorAll("td")].find((td) => td.title.includes("@"));
  expect(email?.title).toContain("@");
  expect(container.querySelector(".max-w-5xl")).toBeNull();
});
