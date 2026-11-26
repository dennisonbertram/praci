// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ORPCError } from "@orpc/client";
import type { Contact, ContactDetail } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetDeletedContacts } from "../lib/use-contact-notices";

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
vi.mock("@rakazo/ui-web", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rakazo/ui-web")>();
  return {
    ...actual,
    ContactAvatar: ({ name, src }: { name: string; src?: string | null }) => (
      <span data-testid="contact-avatar" data-src={src ?? ""}>
        {name}
      </span>
    ),
  };
});
vi.mock("../components/inbox/InboxMessageDialog", () => ({
  InboxMessageDialog: ({
    messageId,
    previousId,
    nextId,
    onNavigate,
  }: {
    messageId: string | null;
    previousId?: string;
    nextId?: string;
    onNavigate?: (messageId: string) => void;
  }) =>
    messageId ? (
      <div data-testid="message">
        {messageId}
        <button type="button" data-testid="previous" onClick={() => onNavigate?.(previousId ?? "")}>
          {previousId ?? ""}
        </button>
        <button type="button" data-testid="next" onClick={() => onNavigate?.(nextId ?? "")}>
          {nextId ?? ""}
        </button>
      </div>
    ) : null,
}));
vi.mock("../components/ComposeEmail", () => ({
  ComposeEmail: ({ restore }: { restore?: { fields: { to: string[] } } }) => (
    <div data-testid="composer">{restore?.fields.to.join(",")}</div>
  ),
}));
const rpcMock = vi.hoisted(() => ({
  detail: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  linked: vi.fn(async () => ({ portal: false, documents: [], safes: 0 })),
  inboxList: vi.fn(),
}));
const detail = rpcMock.detail;
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: {
      detail: rpcMock.detail,
      list: rpcMock.list,
      save: rpcMock.save,
      delete: rpcMock.remove,
      linked: rpcMock.linked,
    },
    inbox: { list: rpcMock.inboxList },
  },
}));

import { ContactDetailPage } from "./ContactDetail";
import { ContactsPage } from "./Contacts";

i18n.loadAndActivate({ locale: "en", messages: {} });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const contact: Contact = {
  id: "c1",
  name: "Ada Example",
  email: "ada@example.test",
  organization: "Acme Corp",
  kind: "investor",
  notes: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
};
const empty: ContactDetail = { contact, mail: [], meetings: [], documents: [], safes: [] };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const Detail = () => <ContactDetailPage id={useParams().id ?? ""} />;
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === label);
const click = (el: Element | undefined) =>
  act(async () => (el as HTMLElement | undefined)?.click());
const flush = () => act(async () => {});
const typeInto = (input: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const show = async () => {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/app/contacts/c1?q=ada"]}>
          <Routes>
            <Route path="/app/contacts" element={<ContactsPage />} />
            <Route path="/app/contacts/:id" element={<Detail />} />
          </Routes>
          <NotificationToaster onOpen={() => {}} />
        </MemoryRouter>
      </I18nProvider>,
    ),
  );
};

beforeEach(() => {
  rpcMock.list.mockResolvedValue([]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => notificationToastManager.close());
  resetDeletedContacts();
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("shows the details and hides every empty section", async () => {
  detail.mockResolvedValue(empty);
  await show();
  expect(container.textContent).toContain("Ada Example");
  expect(container.textContent).toContain("ada@example.test");
  expect(container.textContent).toContain("Acme Corp");
  for (const heading of ["Emails", "Meetings", "Documents", "SAFEs"])
    expect(container.textContent).not.toContain(heading);
});

it("shows the sections that have rows, and opens a mail", async () => {
  detail.mockResolvedValue({
    ...empty,
    mail: [
      {
        id: "m1",
        subject: "Intro",
        from: "Ada",
        snippet: "Hello",
        receivedAt: "2026-10-20T00:00:00.000Z",
      },
    ],
    meetings: [{ id: "g1", title: "Kickoff", startedAt: "2026-10-21T00:00:00.000Z" }],
    documents: [{ id: "d1", name: "terms.pdf" }],
    safes: [{ id: "s1", amountCents: 5_000_000, status: "signed" }],
  });
  await show();
  for (const word of ["Emails", "Intro", "Meetings", "Kickoff", "terms.pdf", "$50,000", "Signed"])
    expect(container.textContent).toContain(word);
  await act(async () => (container.querySelector("section button") as HTMLElement).click());
  expect(document.querySelector("[data-testid=message]")?.textContent).toBe("m1");
});

it("links to Fundraising in place of the old pipeline fields", async () => {
  detail.mockResolvedValue({
    ...empty,
    contact: {
      ...empty.contact,
      kind: "prospect",
      stage: "intro",
      checkSizeCents: 2_500_000,
      nextStep: "Send the deck",
      pipelineRecord: { id: "r1", name: "Sample Street Capital", status: "intro_made" },
    },
  });
  await show();
  const link = [...container.querySelectorAll("a")].find((a) =>
    a.textContent?.includes("Fundraising:"),
  );
  expect(link?.textContent).toBe("Fundraising: Sample Street Capital · Intro made");
  expect(link?.getAttribute("href")).toBe("/app/fundraising?record=c1");
  for (const word of ["Stage", "Check size", "Next step", "Send the deck"])
    expect(container.textContent).not.toContain(word);
});

it("shows an error with Try again", async () => {
  detail.mockRejectedValue(new Error("Contact not found"));
  await show();
  expect(container.querySelector("[role=alert]")?.textContent).toContain("Contact not found");
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it("shows the contact it was switched to when the previous contact loads late", async () => {
  const ada = deferred<ContactDetail>();
  const bo = deferred<ContactDetail>();
  detail.mockImplementation(({ id }: { id: string }) => (id === "c1" ? ada.promise : bo.promise));
  // The route keeps one page mounted while the id changes, as the real router does.
  let open: (id: string) => void = () => {};
  const Navigator = () => {
    const navigate = useNavigate();
    open = (id) => navigate(`/app/contacts/${id}`);
    return null;
  };
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/app/contacts/c1"]}>
          <Routes>
            <Route path="/app/contacts/:id" element={<Detail />} />
          </Routes>
          <Navigator />
        </MemoryRouter>
      </I18nProvider>,
    ),
  );
  await act(async () => open("c2"));
  bo.resolve({ ...empty, contact: { ...contact, id: "c2", name: "Bo Example" } });
  await flush();
  expect(container.querySelector("h1")?.textContent).toContain("Bo Example");
  ada.resolve(empty);
  await flush();
  expect(container.querySelector("h1")?.textContent).toContain("Bo Example");
  expect(container.textContent).not.toContain("Ada Example");
});

it("links each meeting and shared document to its page", async () => {
  detail.mockResolvedValue({
    ...empty,
    meetings: [{ id: "g1", title: "Kickoff", startedAt: "2026-10-21T00:00:00.000Z" }],
    documents: [{ id: "d1", name: "terms.pdf" }],
  });
  await show();
  const href = (label: string) =>
    [...container.querySelectorAll("a")]
      .find((a) => a.textContent?.includes(label))
      ?.getAttribute("href");
  expect(href("Kickoff")).toBe("/app/meetings/g1");
  expect(href("terms.pdf")).toBe("/app/data-room?item=d1");
});

const cy: Contact = { ...contact, id: "c2", name: "Cy", email: "cy@example.test" };
const edit = async () => click(button("Edit"));

it("deletes with an Undo that needs no server call, then focuses the row on the list", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    detail.mockResolvedValue({ ...empty, contact: { ...contact, kind: "other" } });
    rpcMock.remove.mockResolvedValue({ ok: true });
    await show();
    await edit();
    await click(button("Delete"));
    expect(document.body.textContent).toContain("Deleted Ada Example");
    // Back on the list, with the delete still held.
    expect(container.textContent).toContain("Contacts");
    expect(rpcMock.remove).not.toHaveBeenCalled();
    rpcMock.list.mockResolvedValue([contact]);
    await click(button("Undo"));
    await flush();
    expect(rpcMock.remove).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Restored Ada Example");
    expect(document.activeElement?.textContent).toBe("Ada Example");
    expect(document.activeElement?.closest("tr")?.getAttribute("data-contact-id")).toBe(contact.id);
    await act(async () => vi.advanceTimersByTime(5001));
    expect(rpcMock.remove).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("sends null when Notes is cleared, and names the agent that added the contact", async () => {
  const ada = { ...contact, notes: "Old note", addedBy: { id: "b1", name: "Chief" } };
  detail.mockResolvedValue({ ...empty, contact: ada });
  rpcMock.save.mockResolvedValue(ada);
  await show();
  expect(container.textContent).toContain("Chief");
  await edit();
  await typeInto(document.getElementById("contact-notes") as HTMLTextAreaElement, "");
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", notes: null }));
});

it("offers the other contact on a duplicate email, and clears the error when the email changes", async () => {
  detail.mockResolvedValue(empty);
  rpcMock.list.mockResolvedValue([contact, cy]);
  rpcMock.save.mockRejectedValue(new Error("Another contact already has this email."));
  await show();
  await edit();
  await typeInto(document.getElementById("contact-email") as HTMLInputElement, "cy@example.test");
  await click(button("Save"));
  expect(document.body.textContent).toContain("Another contact already has this email.");
  expect(button("Open Cy")).toBeDefined();
  await typeInto(document.getElementById("contact-email") as HTMLInputElement, "cy2@example.test");
  expect(document.body.textContent).not.toContain("Another contact already has this email.");
});

it("clears a save error and loads the selected contact from the dialog", async () => {
  const next = deferred<ContactDetail>();
  detail.mockImplementation(({ id }: { id: string }) =>
    id === "c1" ? Promise.resolve(empty) : next.promise,
  );
  rpcMock.list.mockResolvedValue([cy]);
  rpcMock.save.mockRejectedValue(new Error("Another contact already has this email."));
  await show();
  await edit();
  await typeInto(document.getElementById("contact-email") as HTMLInputElement, "cy@example.test");
  await click(button("Save"));
  expect(document.body.textContent).toContain("Another contact already has this email.");
  await click(button("Open Cy"));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(detail).toHaveBeenLastCalledWith({ id: cy.id });
  next.resolve({ ...empty, contact: cy });
  await flush();
  expect(container.querySelector("h1")?.textContent).toContain("Cy");
});

it("marks the Email invalid while typing an email another contact has", async () => {
  detail.mockResolvedValue(empty);
  rpcMock.list.mockResolvedValue([contact, cy]);
  await show();
  await edit();
  const email = document.getElementById("contact-email") as HTMLInputElement;
  await typeInto(email, "cy@example.test");
  expect(email.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(email.getAttribute("aria-describedby") ?? "")?.textContent,
  ).toContain("Another contact already has this email.");
  expect(rpcMock.save).not.toHaveBeenCalled();
});

it("refreshes the contact when the page returns to focus", async () => {
  detail.mockResolvedValueOnce(empty).mockResolvedValueOnce({
    ...empty,
    contact: { ...contact, name: "Ada Updated" },
  });
  await show();
  expect(container.textContent).toContain("Ada Example");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Ada Updated");
  expect(container.textContent).not.toContain("Ada Example");
});

it("keeps the loaded contact visible when a background refresh fails", async () => {
  detail.mockResolvedValueOnce(empty).mockRejectedValueOnce(new Error("Temporary failure"));
  await show();
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(detail).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("Ada Example");
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("shows the not-found error when a contact is deleted elsewhere", async () => {
  detail
    .mockResolvedValueOnce(empty)
    .mockRejectedValueOnce(new ORPCError("NOT_FOUND", { message: "Contact not found" }));
  await show();
  await edit();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Contact not found");
  expect(button("Try again")).toBeDefined();
  expect(button("Edit")).toBeUndefined();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("loads other contacts when Edit opens instead of on mount", async () => {
  detail.mockResolvedValue(empty);
  rpcMock.list.mockResolvedValue([cy]);
  await show();
  expect(rpcMock.list).not.toHaveBeenCalled();
  await edit();
  expect(rpcMock.list).toHaveBeenCalledTimes(1);
  expect(rpcMock.list).toHaveBeenCalledWith({});
});

it("keeps the saved contact visible when its follow-up refresh fails", async () => {
  const saved = { ...contact, name: "Ada Saved" };
  detail.mockResolvedValueOnce(empty).mockRejectedValueOnce(new Error("Temporary failure"));
  rpcMock.save.mockResolvedValue(saved);
  await show();
  await edit();
  await typeInto(document.getElementById("contact-name") as HTMLInputElement, saved.name);
  await click(button("Save"));
  expect(container.textContent).toContain("Ada Saved");
  expect(container.textContent).not.toContain("Could not load contact");
});

it("does not let an older background refresh overwrite a saved name", async () => {
  const oldRefresh = deferred<ContactDetail>();
  const saved = { ...contact, name: "Ada Saved" };
  detail
    .mockResolvedValueOnce(empty)
    .mockImplementationOnce(() => oldRefresh.promise)
    .mockResolvedValueOnce({ ...empty, contact: saved });
  rpcMock.save.mockResolvedValue(saved);
  await show();
  await act(async () => window.dispatchEvent(new Event("focus")));
  await edit();
  await typeInto(document.getElementById("contact-name") as HTMLInputElement, saved.name);
  await click(button("Save"));
  expect(container.querySelector("h1")?.textContent).toContain("Ada Saved");
  oldRefresh.resolve({ ...empty, contact: { ...contact, name: "Ada Stale" } });
  await flush();
  expect(container.querySelector("h1")?.textContent).toContain("Ada Saved");
  expect(container.textContent).not.toContain("Ada Stale");
});

it("keeps the current avatar when saving without changing the email", async () => {
  const withPhoto = { ...contact, photoUrl: "https://example.test/ada.png" };
  const saved = { ...withPhoto, name: "Ada Saved", photoUrl: null };
  detail
    .mockResolvedValueOnce({ ...empty, contact: withPhoto })
    .mockRejectedValueOnce(new Error("Temporary failure"));
  rpcMock.save.mockResolvedValue(saved);
  await show();
  await edit();
  await typeInto(document.getElementById("contact-name") as HTMLInputElement, saved.name);
  await click(button("Save"));
  expect(container.querySelector('[data-testid="contact-avatar"]')?.getAttribute("data-src")).toBe(
    withPhoto.photoUrl,
  );
});

const mail = (n: number): ContactDetail["mail"][number] => ({
  id: `m${n}`,
  subject: `Mail ${n}`,
  from: "Ada",
  snippet: "Hi",
  receivedAt: "2026-10-20T00:00:00.000Z",
});
const emailLink = () => container.querySelector('a[href="mailto:ada@example.test"]');
const composer = () => document.querySelector("[data-testid=composer]");

it("opens the composer addressed to the contact when the email is clicked", async () => {
  rpcMock.inboxList.mockResolvedValue({
    accounts: [{ connectionId: "g1", label: "ada@gmail.test" }],
  });
  detail.mockResolvedValue(empty);
  await show();
  await click(emailLink() ?? undefined);
  expect(rpcMock.inboxList).toHaveBeenCalledTimes(1);
  expect(rpcMock.inboxList).toHaveBeenCalledWith({});
  expect(composer()?.textContent).toBe("ada@example.test");
});

it("shows Connect Gmail to send and no composer when no account is connected", async () => {
  rpcMock.inboxList.mockResolvedValue({ accounts: [] });
  detail.mockResolvedValue(empty);
  await show();
  await click(emailLink() ?? undefined);
  expect(document.body.textContent).toContain("Connect Gmail to send");
  expect(composer()).toBeNull();
});

it("makes no call on a modified click of the email link", async () => {
  detail.mockResolvedValue(empty);
  await show();
  await act(async () => {
    emailLink()?.dispatchEvent(new MouseEvent("click", { bubbles: true, metaKey: true }));
  });
  expect(rpcMock.inboxList).not.toHaveBeenCalled();
  expect(composer()).toBeNull();
});

it("does not list inbox accounts until the email is clicked", async () => {
  detail.mockResolvedValue(empty);
  await show();
  expect(rpcMock.inboxList).not.toHaveBeenCalled();
});

it("ignores a second click while accounts are still loading", async () => {
  const pending = deferred<{ accounts: { connectionId: string; label: string }[] }>();
  rpcMock.inboxList.mockImplementation(() => pending.promise);
  detail.mockResolvedValue(empty);
  await show();
  await click(emailLink() ?? undefined);
  await click(emailLink() ?? undefined);
  expect(rpcMock.inboxList).toHaveBeenCalledTimes(1);
  pending.resolve({ accounts: [{ connectionId: "g1", label: "ada@gmail.test" }] });
  await flush();
  expect(composer()?.textContent).toBe("ada@example.test");
});

it("links to all mail with the contact when Emails hits its cap", async () => {
  detail.mockResolvedValue({
    ...empty,
    mail: Array.from({ length: 10 }, (_, i) => mail(i + 1)),
  });
  await show();
  const link = [...container.querySelectorAll("a")].find(
    (a) => a.textContent === "All mail with Ada Example",
  );
  expect(link?.getAttribute("href")).toBe("/app/inbox?q=ada%40example.test");
});

it("shows no all-mail link under the cap", async () => {
  detail.mockResolvedValue({ ...empty, mail: Array.from({ length: 9 }, (_, i) => mail(i + 1)) });
  await show();
  expect(
    [...container.querySelectorAll("a")].some((a) => a.textContent?.includes("All mail")),
  ).toBe(false);
});

it("shows no all-mail link when the contact has no email", async () => {
  detail.mockResolvedValue({
    ...empty,
    contact: { ...contact, email: null },
    mail: Array.from({ length: 10 }, (_, i) => mail(i + 1)),
  });
  await show();
  expect(
    [...container.querySelectorAll("a")].some((a) => a.textContent?.includes("All mail")),
  ).toBe(false);
});

const meeting = (n: number): ContactDetail["meetings"][number] => ({
  id: `g${n}`,
  title: `Meeting ${n}`,
  startedAt: "2026-10-21T00:00:00.000Z",
});

it("links to all meetings with the contact when Meetings hits its cap", async () => {
  detail.mockResolvedValue({
    ...empty,
    meetings: Array.from({ length: 10 }, (_, i) => meeting(i + 1)),
  });
  await show();
  const link = [...container.querySelectorAll("a")].find(
    (a) => a.textContent === "All meetings with Ada Example",
  );
  expect(link?.getAttribute("href")).toBe("/app/meetings?attendee=ada%40example.test");
});

it("shows no all-meetings link under the cap", async () => {
  detail.mockResolvedValue({
    ...empty,
    meetings: Array.from({ length: 9 }, (_, i) => meeting(i + 1)),
  });
  await show();
  expect(
    [...container.querySelectorAll("a")].some((a) => a.textContent?.includes("All meetings")),
  ).toBe(false);
});

it("shows no all-meetings link at the cap when the contact has no email", async () => {
  detail.mockResolvedValue({
    ...empty,
    contact: { ...contact, email: null },
    meetings: Array.from({ length: 10 }, (_, i) => meeting(i + 1)),
  });
  await show();
  expect(
    [...container.querySelectorAll("a")].some((a) => a.textContent?.includes("All meetings")),
  ).toBe(false);
});

it("steps through the contact's threads with previous and next", async () => {
  detail.mockResolvedValue({ ...empty, mail: [mail(1), mail(2), mail(3)] });
  await show();
  await click(
    [...container.querySelectorAll("section button")].find((b) =>
      b.textContent?.includes("Mail 2"),
    ),
  );
  expect(document.querySelector("[data-testid=message]")?.textContent).toContain("m2");
  expect(document.querySelector("[data-testid=previous]")?.textContent).toBe("m1");
  expect(document.querySelector("[data-testid=next]")?.textContent).toBe("m3");
  await click(document.querySelector("[data-testid=next]") ?? undefined);
  expect(document.querySelector("[data-testid=message]")?.textContent).toContain("m3");
  expect(document.querySelector("[data-testid=previous]")?.textContent).toBe("m2");
  expect(document.querySelector("[data-testid=next]")?.textContent).toBe("");
});

it("clears the avatar when saving with a changed email", async () => {
  const withPhoto = { ...contact, photoUrl: "https://example.test/ada.png" };
  const saved = { ...withPhoto, email: "ada.new@example.test" };
  detail
    .mockResolvedValueOnce({ ...empty, contact: withPhoto })
    .mockRejectedValueOnce(new Error("Temporary failure"));
  rpcMock.save.mockResolvedValue(saved);
  await show();
  await edit();
  await typeInto(document.getElementById("contact-email") as HTMLInputElement, saved.email);
  await click(button("Save"));
  expect(container.querySelector('[data-testid="contact-avatar"]')?.getAttribute("data-src")).toBe(
    "",
  );
});
