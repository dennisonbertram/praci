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
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  linked: vi.fn(async () => ({ portal: false, documents: [], safes: 0 })),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: {
      list: rpcMock.list,
      save: rpcMock.save,
      delete: rpcMock.remove,
      linked: rpcMock.linked,
    },
  },
}));

import { resetDeletedContacts } from "../lib/use-contact-notices";
import { RETURN_DEDUPE_MS } from "../lib/use-refetch-while-open";
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
let path = "";
const Where = () => {
  const location = useLocation();
  search = location.search;
  path = location.pathname + location.search;
  return null;
};
const show = async (url = "/app/contacts", onAskAgent?: () => void) => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <ContactsPage onAskAgent={onAskAgent} />
        <Where />
        <NotificationToaster onOpen={() => {}} />
      </MemoryRouter>,
    ),
  );
  await flush();
};
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === label);
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
    (item) => item.textContent === label,
  );
const rowActions = (name: string) =>
  container.querySelector<HTMLElement>(`button[aria-label="Actions for ${name}"]`) ?? undefined;
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
  resetDeletedContacts();
  vi.useRealTimers();
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

it("shows an icon, title, one sentence and Add contact when there are no contacts", async () => {
  rpcMock.list.mockResolvedValueOnce([]);
  await show();
  expect(container.querySelector("h2")?.textContent).toBe("No contacts yet");
  expect(container.querySelector("h2 + p")?.textContent).toContain("Investors, advisors");
  expect(
    [...container.querySelectorAll("button")].filter((b) => b.textContent?.includes("Add contact")),
  ).toHaveLength(1);
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

it("keeps the list and refreshing when a background refresh fails", async () => {
  rpcMock.list
    .mockResolvedValueOnce([contact("c1", "Ada", "other")])
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue([contact("c1", "Ada", "other"), contact("c2", "Bo", "investor")]);
  await show();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await flush();
  // The failed refresh leaves Ada on screen, with no error in her place.
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).not.toContain("Could not load contacts");
  // A second return inside the dedupe window would count as the same return.
  const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + RETURN_DEDUPE_MS + 1);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await flush();
  now.mockRestore();
  expect(container.textContent).toContain("Bo");
});

it("shows a contact an agent added once the window regains focus", async () => {
  rpcMock.list
    .mockResolvedValueOnce([contact("c1", "Ada", "other")])
    .mockResolvedValue([contact("c1", "Ada", "other"), contact("c2", "Bo", "investor")]);
  await show();
  expect(container.textContent).not.toContain("Bo");
  expect(document.visibilityState).toBe("visible");
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await flush();
  expect(container.textContent).toContain("Bo");
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

it("opens the contact page from any cell of its row, keeping the search and filter", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  await show("/app/contacts?q=ada&kind=other");
  await click(container.querySelector("tbody td:nth-child(3)") as HTMLElement);
  expect(path).toBe("/app/contacts/c1?q=ada&kind=other");
});

it("edits a contact from its row menu, staying on the list", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  await show();
  await click(rowActions("Ada"));
  await click(menuItem("Edit"));
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Ada");
  expect(path).toBe("/app/contacts");
});

/** Runs `body` with fake timers, so the Undo window can be crossed without waiting. */
const withClock = async (body: () => Promise<void>) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await body();
  } finally {
    vi.useRealTimers();
  }
};
const passUndoWindow = () => act(async () => vi.advanceTimersByTime(5001));

it("deletes a contact from its row menu behind Undo, holding the server call inside the window", () =>
  withClock(async () => {
    rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other"), contact("c2", "Bo", "vendor")]);
    rpcMock.remove.mockResolvedValue({ ok: true });
    await show();
    await click(rowActions("Ada"));
    await click(menuItem("Delete"));
    expect(container.querySelector('[data-contact-id="c1"]')).toBeNull();
    expect(document.body.textContent).toContain("Deleted Ada");
    expect(button("Undo")).toBeDefined();
    expect(rpcMock.remove).not.toHaveBeenCalled();
    await passUndoWindow();
    expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c1" });
  }));

it("asks before deleting a contact with links, and Cancel deletes nothing", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  rpcMock.linked.mockResolvedValue({ portal: true, documents: [], safes: 0 });
  await show();
  await click(rowActions("Ada"));
  await click(menuItem("Delete"));
  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain("Delete Ada?");
  expect(rpcMock.remove).not.toHaveBeenCalled();
  await click(
    [...(dialog?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Cancel"),
  );
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(rpcMock.remove).not.toHaveBeenCalled();
  expect(container.querySelector('[data-contact-id="c1"]')).not.toBeNull();
});

it("opens the row menu and chooses an item without opening the contact page", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  await show();
  await click(rowActions("Ada"));
  expect(path).toBe("/app/contacts");
  // The menu renders in a portal as divs, so an unguarded click would reach the row and navigate.
  await click(menuItem("Delete"));
  expect(path).toBe("/app/contacts");
  expect(document.body.textContent).toContain("Deleted Ada");
});

it("returns focus to Add contact when the new-contact dialog closes", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  await show();
  const add = button("Add contact") as HTMLElement;
  add.focus();
  await click(add);
  await act(async () => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  await flush();
  expect(document.activeElement).toBe(add);
});

it("focuses Search after Clear filters", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "other")]);
  await show("/app/contacts?q=zzz");
  await click(button("Clear filters"));
  expect(document.activeElement).toBe(container.querySelector("input[name=contacts-search]"));
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

it("shows the organization and the email under the name", async () => {
  rpcMock.list.mockResolvedValue([
    contact("c1", "Ada", "customer"),
    { ...contact("c3", "Cy", "vendor"), organization: null },
    { ...contact("c4", "Di", "other"), email: null },
  ]);
  await show();
  const under = [...container.querySelectorAll("tbody td:first-child div.flex.flex-wrap")].map(
    (div) => div.textContent,
  );
  expect(under).toEqual(["Acme Corp·ada@example.test", "cy@example.test", "Acme Corp"]);
});

it("clears the search and confirms when a new contact is saved", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "vendor")]);
  rpcMock.save.mockResolvedValue(contact("c2", "Cy", "vendor"));
  await show("/app/contacts?q=ada");
  await click(button("Add contact"));
  await typeInto(document.getElementById("contact-name") as HTMLInputElement, "Cy");
  await click(button("Save"));
  expect(search).toBe("");
  expect(document.body.textContent).toContain("Added Cy");
});

it("lets the table fill the page and titles a long email", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "customer")]);
  await show();
  const email = [...container.querySelectorAll("td")].find((td) => td.title.includes("@"));
  expect(email?.title).toContain("@");
  expect(container.querySelector(".max-w-5xl")).toBeNull();
});

it("offers Ask Chief beside Add contact, and nothing when Chief is not available", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "customer")]);
  await show("/app/contacts", undefined);
  expect(button("Ask")).toBeUndefined();
  const ask = vi.fn();
  await show("/app/contacts", ask);
  await click(button("Ask"));
  expect(ask).toHaveBeenCalledOnce();
});

it("keeps the header out of the scrolling list", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "customer")]);
  await show();
  const scroller = container.querySelector(".rk-scroll");
  expect(scroller?.querySelector("[data-page-header]")).toBeNull();
  expect(scroller?.querySelector("table")).not.toBeNull();
});

const names = () =>
  [...container.querySelectorAll("tbody [data-row-open]")].map((b) => b.textContent);
const head = (label: string) =>
  [...container.querySelectorAll<HTMLElement>("thead th button")].find(
    (b) => b.textContent === label,
  );

it("sorts by a column header, keeps the order unless asked, and carries the sort to the detail page", async () => {
  rpcMock.list.mockResolvedValue([
    contact("c1", "Cy", "vendor"),
    contact("c2", "Ada", "customer"),
    contact("c3", "Bo", "advisor"),
  ]);
  await show();
  expect(names()).toEqual(["Cy", "Ada", "Bo"]);
  await click(head("Name"));
  expect(names()).toEqual(["Ada", "Bo", "Cy"]);
  expect(search).toBe("?sort=name&dir=asc");
  await click(head("Name"));
  expect(names()).toEqual(["Cy", "Bo", "Ada"]);
  await click(head("Kind"));
  expect(names()).toEqual(["Bo", "Ada", "Cy"]); // Advisor, Customer, Vendor
  await click(container.querySelector("[data-contact-id=c2] [data-row-open]") ?? undefined);
  expect(path).toBe("/app/contacts/c2?sort=kind&dir=asc");
});

it("gives the avatar the contact's photo when there is one", async () => {
  // The avatar shows its image only once the browser has loaded it; jsdom never does.
  class LoadedImage {
    onload: (() => void) | null = null;
    set src(_: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", LoadedImage);
  try {
    rpcMock.list.mockResolvedValue([
      {
        ...contact("c1", "Ada", "customer"),
        photoUrl: "/api/contacts/photo?email=ada%40example.test",
      },
      contact("c2", "Bo", "vendor"),
    ]);
    await show();
    await flush();
    const rowOf = (name: string) =>
      [...container.querySelectorAll("tbody tr")].find((row) => row.textContent?.includes(name));
    expect(rowOf("Ada")?.querySelector("img")?.getAttribute("src")).toBe(
      "/api/contacts/photo?email=ada%40example.test",
    );
    expect(rowOf("Bo")?.querySelector("img")).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
