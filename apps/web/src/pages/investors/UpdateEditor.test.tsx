// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import type { Contact, InvestorUpdate } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  send: vi.fn(),
  post: vi.fn(),
  retry: vi.fn(),
  markDelivered: vi.fn(),
  accounts: vi.fn(),
  contacts: vi.fn(),
  agent: vi.fn(),
  threadsSend: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    contacts: { list: rpcMock.contacts },
    investors: {
      agent: rpcMock.agent,
      updates: {
        get: rpcMock.get,
        save: rpcMock.save,
        send: rpcMock.send,
        post: rpcMock.post,
        retry: rpcMock.retry,
        markDelivered: rpcMock.markDelivered,
        accounts: rpcMock.accounts,
      },
    },
    threads: { send: rpcMock.threadsSend },
  },
}));

import { UNDO_SEND_MS } from "../../lib/outbox";
import { UpdateEditor } from "./UpdateEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const contact = (id: string, name: string, email: string | null): Contact => ({
  id,
  name,
  email,
  organization: null,
  kind: "investor",
  notes: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});
const update = (over: Partial<InvestorUpdate> = {}): InvestorUpdate => ({
  id: "u1",
  audience: "investors",
  subject: "Example Co · 2026-09 update",
  period: "2026-09",
  body: "September went well.",
  status: "draft",
  recipientContactIds: ["c1", "c2"],
  fromConnectionId: null,
  deliveries: [],
  sentAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  ...over,
});
const gmail = [{ connectionId: "g1", label: "me@example.test" }];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const button = (label: string) =>
  [...document.querySelectorAll("button, a")].find((b) => b.textContent === label) as
    | HTMLElement
    | undefined;
const click = (el: HTMLElement | undefined) => act(async () => el?.click());
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

async function show(
  initial: InvestorUpdate,
  accounts: unknown[] = gmail,
  lookupOk = true,
  draftLookupOk = true,
) {
  if (draftLookupOk) rpcMock.get.mockResolvedValue(initial);
  if (lookupOk) rpcMock.accounts.mockResolvedValue(accounts);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors/updates/u1"]}>
        <UpdateEditor updateId="u1" />
        <NotificationToaster onOpen={() => {}} />
      </MemoryRouter>,
    ),
  );
  await flush();
  await flush();
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.contacts.mockResolvedValue([
    contact("c1", "Ada", "ada@example.test"),
    contact("c2", "Bo", "bo@example.test"),
    contact("c3", "Cy", null),
  ]);
  rpcMock.save.mockResolvedValue(update());
});
afterEach(() => {
  act(() => notificationToastManager.close());
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("asks once about leftover TBD, in the button row, and the Send label never shows the count", async () => {
  vi.useFakeTimers();
  await show(update({ body: "Revenue was TBD." }));
  expect(document.querySelectorAll("[data-tbd]").length).toBe(1);
  expect(button("Send")).toBeDefined();
  rpcMock.send.mockResolvedValue(update({ status: "sending" }));
  await click(button("Send"));
  expect(rpcMock.send).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("1 TBD left. Send anyway?");
  await click(button("Keep editing"));
  expect(button("Send")).toBeDefined();
  await click(button("Send"));
  await click(button("Send anyway"));
  expect(rpcMock.send).not.toHaveBeenCalled();
  await advance(UNDO_SEND_MS);
  expect(rpcMock.send).toHaveBeenCalledWith({ id: "u1" });
});

it("sends without asking when nothing is TBD", async () => {
  vi.useFakeTimers();
  rpcMock.send.mockResolvedValue(update({ status: "sending" }));
  await show(update());
  await click(button("Send"));
  expect(document.body.textContent).not.toContain("TBD left");
  await advance(UNDO_SEND_MS);
  expect(rpcMock.send).toHaveBeenCalledOnce();
});

it("holds Send for the undo window, then sends exactly once", async () => {
  vi.useFakeTimers();
  rpcMock.send.mockResolvedValue(update({ status: "sending" }));
  await show(update());
  await click(button("Send"));
  expect(document.body.textContent).toContain("Sending…");
  expect(button("Undo")).toBeDefined();
  await advance(UNDO_SEND_MS - 1);
  expect(rpcMock.send).not.toHaveBeenCalled();
  await advance(1);
  expect(rpcMock.send).toHaveBeenCalledOnce();
  await advance(UNDO_SEND_MS * 2);
  expect(rpcMock.send).toHaveBeenCalledOnce();
});

it("Undo during the hold sends nothing and makes the draft editable again", async () => {
  vi.useFakeTimers();
  await show(update());
  const subject = () => document.getElementById("update-subject") as HTMLInputElement;
  await click(button("Send"));
  expect(subject().disabled).toBe(true);
  expect((document.getElementById("to-c1") as HTMLInputElement).disabled).toBe(true);
  await click(button("Undo"));
  await advance(UNDO_SEND_MS * 2);
  expect(rpcMock.send).not.toHaveBeenCalled();
  expect(subject().disabled).toBe(false);
  expect(button("Send")).toBeDefined();
});

it("leaving the page during the hold sends at once, and only once", async () => {
  vi.useFakeTimers();
  rpcMock.send.mockResolvedValue(update({ status: "sending" }));
  await show(update());
  await click(button("Send"));
  expect(rpcMock.send).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  expect(rpcMock.send).toHaveBeenCalledOnce();
  expect(rpcMock.send).toHaveBeenCalledWith({ id: "u1" });
  await advance(UNDO_SEND_MS * 2);
  expect(rpcMock.send).toHaveBeenCalledOnce();
  root = createRoot(container);
});

it("shows why Send is unavailable when the contacts fail to load, and recovers with Try again", async () => {
  rpcMock.contacts.mockRejectedValueOnce(new Error("down"));
  await show(update());
  expect(document.body.textContent).not.toContain("No investors yet");
  expect(document.querySelector("[role=alert]")?.textContent).toContain("down");
  expect(button("Try again")).toBeDefined();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(true);
  await click(button("Try again"));
  await flush();
  expect(document.getElementById("to-c1")).not.toBeNull();
  expect(document.querySelector("[role=alert]")).toBeNull();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(false);
});

it("retries the initial update and recipient load after the draft lookup fails", async () => {
  rpcMock.get.mockRejectedValueOnce(new Error("draft unavailable")).mockResolvedValueOnce(update());
  await show(update(), gmail, true, false);
  expect(document.querySelector("[role=alert]")?.textContent).toContain("draft unavailable");

  await click(button("Try again"));
  await flush();
  await flush();

  expect(rpcMock.get).toHaveBeenCalledTimes(2);
  expect(rpcMock.contacts).toHaveBeenCalledWith({ kind: "investor" });
  expect(document.querySelector('fieldset[aria-busy="true"]')).toBeNull();
  expect((document.getElementById("to-c1") as HTMLInputElement).checked).toBe(true);
  expect((button("Send") as HTMLButtonElement).disabled).toBe(false);
});

it("keeps the recipient list loading until contacts arrive instead of showing the empty state", async () => {
  let resolveContacts!: (contacts: Contact[]) => void;
  rpcMock.contacts.mockReturnValueOnce(
    new Promise<Contact[]>((resolve) => {
      resolveContacts = resolve;
    }),
  );
  await show(update());
  expect(document.querySelector('fieldset[aria-busy="true"]')).not.toBeNull();
  expect(document.body.textContent).not.toContain("No investors yet");
  expect((button("Send") as HTMLButtonElement).disabled).toBe(true);

  await act(async () => {
    resolveContacts([
      contact("c1", "Ada", "ada@example.test"),
      contact("c2", "Bo", "bo@example.test"),
    ]);
  });
  await flush();
  expect(document.querySelector('fieldset[aria-busy="true"]')).toBeNull();
  expect(document.getElementById("to-c1")).not.toBeNull();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(false);
});

it("loads contacts for the accepted agent refresh without duplicating accounts or applying a stale draft", async () => {
  let resolveInitial!: (value: InvestorUpdate) => void;
  let resolveRefresh!: (value: InvestorUpdate) => void;
  let resolveContacts!: (value: Contact[]) => void;
  let resolveAccounts!: (value: typeof gmail) => void;
  rpcMock.get
    .mockReturnValueOnce(new Promise<InvestorUpdate>((resolve) => (resolveInitial = resolve)))
    .mockReturnValueOnce(new Promise<InvestorUpdate>((resolve) => (resolveRefresh = resolve)));
  rpcMock.contacts.mockReturnValueOnce(
    new Promise<Contact[]>((resolve) => (resolveContacts = resolve)),
  );
  rpcMock.accounts.mockReturnValueOnce(
    new Promise<typeof gmail>((resolve) => (resolveAccounts = resolve)),
  );

  await showBusy(true);
  expect(rpcMock.get).toHaveBeenCalledTimes(1);
  expect(rpcMock.accounts).toHaveBeenCalledTimes(1);

  await showBusy(false);
  expect(rpcMock.get).toHaveBeenCalledTimes(2);
  const accepted = update({
    audience: "board",
    subject: "Agent draft accepted",
    recipientContactIds: ["b1"],
  });
  await act(async () => resolveRefresh(accepted));
  await flush();

  expect((document.getElementById("update-subject") as HTMLInputElement).value).toBe(
    "Agent draft accepted",
  );
  expect(rpcMock.contacts).toHaveBeenCalledTimes(1);
  expect(rpcMock.contacts).toHaveBeenCalledWith({ kind: "board" });
  expect(rpcMock.accounts).toHaveBeenCalledTimes(1);
  expect(document.querySelector('fieldset[aria-busy="true"]')).not.toBeNull();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(true);

  await act(async () =>
    resolveContacts([{ ...contact("b1", "Board member", "board@example.test"), kind: "board" }]),
  );
  await flush();
  expect(document.querySelector('fieldset[aria-busy="true"]')).toBeNull();
  expect(document.getElementById("to-b1")).not.toBeNull();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(true);

  await act(async () => resolveAccounts(gmail));
  await flush();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(false);

  await act(async () => resolveInitial(update({ subject: "Stale initial draft" })));
  await flush();
  expect((document.getElementById("update-subject") as HTMLInputElement).value).toBe(
    "Agent draft accepted",
  );
  expect(rpcMock.contacts).toHaveBeenCalledTimes(1);
  expect(rpcMock.accounts).toHaveBeenCalledTimes(1);
});

it("shows an alert and retries Gmail account loading when it fails", async () => {
  rpcMock.accounts.mockRejectedValueOnce(new Error("down")).mockResolvedValue(gmail);
  await show(update(), undefined, false);
  expect(button("Try again")).toBeDefined();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(true);
  expect(rpcMock.accounts).toHaveBeenCalledTimes(1);

  await click(button("Try again"));
  await flush();
  await flush();
  expect(rpcMock.accounts).toHaveBeenCalledTimes(2);
  expect(document.querySelector("[role=alert]")).toBeNull();
  expect((button("Send") as HTMLButtonElement).disabled).toBe(false);
});

it("clears a sending update when its refresh says it was deleted", async () => {
  vi.useFakeTimers();
  await show(update({ status: "sending" }));
  rpcMock.get.mockRejectedValueOnce(new ORPCError("NOT_FOUND", { message: "Update not found" }));
  await advance(1500);
  expect(document.body.textContent).toContain("Update not found");
  expect(button("Try again")).toBeDefined();
  expect(document.getElementById("update-subject")).toBeNull();
  expect(button("Send")).toBeUndefined();
  expect(button("Save")).toBeUndefined();
  vi.useRealTimers();
});

it("keeps the update visible after a transient refresh failure", async () => {
  vi.useFakeTimers();
  await show(update({ status: "sending" }));
  rpcMock.get.mockRejectedValueOnce(new Error("offline"));
  await advance(1500);
  expect(document.getElementById("update-subject")).not.toBeNull();
  vi.useRealTimers();
});

it("shows a sent update read-only with no footer button", async () => {
  await show(update({ status: "sent", sentAt: "2026-10-02T09:00:00.000Z" }));
  expect((document.getElementById("update-subject") as HTMLInputElement).disabled).toBe(true);
  expect(document.querySelector("[contenteditable=false]")).not.toBeNull();
  expect(button("Send")).toBeUndefined();
  expect(button("Done")).toBeUndefined();
  expect(document.body.textContent).toContain("Sent");
});

it.each([
  ["draft", "Draft"],
  ["sending", "Sending"],
  ["sent", "Sent"],
  ["partly_sent", "Partly sent"],
  ["posted", "Posted"],
] as const)("names a %s update %s in the header badge", async (status, label) => {
  vi.useFakeTimers();
  await show(update({ status }));
  expect(document.querySelector('[data-slot="badge"]')?.textContent).toBe(label);
});

it("takes its recipients from the audience: the board update lists board contacts", async () => {
  await show(update({ audience: "board" }));
  expect(rpcMock.contacts).toHaveBeenCalledWith({ kind: "board" });
});

it("greys a recipient without an email and leaves it unticked", async () => {
  await show(update());
  const cy = document.getElementById("to-c3") as HTMLInputElement;
  expect(cy.checked).toBe(false);
  expect(cy.disabled).toBe(true);
  expect(document.querySelector("label[for=to-c3]")?.textContent).toContain("no email");
  expect((document.getElementById("to-c1") as HTMLInputElement).checked).toBe(true);
});

it("does not enable email Send when the only saved recipient has no email", async () => {
  await show(update({ recipientContactIds: ["c3"] }));
  expect((document.getElementById("to-c3") as HTMLInputElement).checked).toBe(false);
  expect((document.getElementById("to-c3") as HTMLInputElement).disabled).toBe(true);
  expect((button("Send") as HTMLButtonElement).disabled).toBe(true);
});

it("without Gmail an investor update is posted to the portal, with Connect Gmail as the other action", async () => {
  await show(update(), []);
  expect(document.body.textContent).not.toContain("To");
  expect(document.getElementById("to-c1")).toBeNull();
  expect(button("Post to portal")).toBeDefined();
  expect(button("Connect Gmail")).toBeDefined();
  expect(button("Send")).toBeUndefined();
  expect(button("Connect Gmail to send")).toBeUndefined();
});

it("does not offer Post to portal while the Gmail lookup is failing", async () => {
  rpcMock.accounts.mockRejectedValue(new Error("down"));
  await show(update(), undefined, false);
  expect(button("Post to portal")).toBeUndefined();
});

it("without Gmail a board update has only Connect Gmail to send: board updates never reach the portal", async () => {
  await show(update({ audience: "board" }), []);
  expect(button("Connect Gmail to send")).toBeDefined();
  expect(button("Post to portal")).toBeUndefined();
  expect(button("Send")).toBeUndefined();
});

it("Post to portal posts the draft and says how many were notified", async () => {
  rpcMock.post.mockResolvedValue({ update: update({ status: "posted" }), notified: 2 });
  await show(update(), []);
  await click(button("Post to portal"));
  expect(rpcMock.post).toHaveBeenCalledWith({ id: "u1" });
  expect(document.body.textContent).toContain("Posted · 2 notified");
});

it("keeps portal posting available for a portal-linked recipient without email", async () => {
  rpcMock.contacts.mockResolvedValue([
    { ...contact("c3", "Cy", null), portalLinkSentAt: "2026-09-01T00:00:00.000Z" },
  ]);
  rpcMock.post.mockResolvedValue({ update: update({ status: "posted" }), notified: 1 });
  await show(update({ recipientContactIds: ["c3"] }), []);

  expect(button("Post to portal")).toBeDefined();
  expect((button("Post to portal") as HTMLButtonElement).disabled).toBe(false);
  await click(button("Post to portal"));
  expect(rpcMock.post).toHaveBeenCalledWith({ id: "u1" });
});

it("asks once about leftover TBD before posting, like Send", async () => {
  rpcMock.post.mockResolvedValue({ update: update({ status: "posted" }), notified: 0 });
  await show(update({ body: "Revenue was TBD." }), []);
  await click(button("Post to portal"));
  expect(rpcMock.post).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("1 TBD left. Send anyway?");
  await click(button("Send anyway"));
  expect(rpcMock.post).toHaveBeenCalledOnce();
});

it("shows a posted update read-only with no footer button", async () => {
  await show(update({ status: "posted", sentAt: "2026-10-02T09:00:00.000Z" }), []);
  expect((document.getElementById("update-subject") as HTMLInputElement).disabled).toBe(true);
  expect(button("Post to portal")).toBeUndefined();
  expect(document.body.textContent).toContain("Posted");
});

it("greys a revoked recipient, unticks it and never sends to it", async () => {
  rpcMock.contacts.mockResolvedValue([
    { ...contact("c1", "Ada", "ada@example.test"), portalBlockedAt: "2026-10-10T00:00:00.000Z" },
    contact("c2", "Bo", "bo@example.test"),
  ]);
  rpcMock.send.mockResolvedValue(update({ status: "sending" }));
  vi.useFakeTimers();
  await show(update());
  const ada = document.getElementById("to-c1") as HTMLInputElement;
  expect(ada.checked).toBe(false);
  expect(ada.disabled).toBe(true);
  expect(document.querySelector("label[for=to-c1]")?.textContent).toContain("revoked");
  expect((document.getElementById("to-c2") as HTMLInputElement).checked).toBe(true);
  await click(button("Send"));
  expect(rpcMock.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ recipientContactIds: ["c2"] }),
  );
});

it("says unticked investors still see the update when one with portal access is unticked", async () => {
  rpcMock.contacts.mockResolvedValue([
    { ...contact("c1", "Ada", "ada@example.test"), portalLinkSentAt: "2026-09-01T00:00:00.000Z" },
    contact("c2", "Bo", "bo@example.test"),
  ]);
  await show(update());
  expect(document.body.textContent).not.toContain("Unticked investors");
  await click(document.getElementById("to-c1") as HTMLElement);
  expect(document.body.textContent).toContain("Unticked investors still see this on the portal.");
  // Bo has no portal access, so unticking Bo alone adds nothing.
  await click(document.getElementById("to-c1") as HTMLElement);
  await click(document.getElementById("to-c2") as HTMLElement);
  expect(document.body.textContent).not.toContain("Unticked investors");
});

it("never shows the unticked-investors line on a board update", async () => {
  rpcMock.contacts.mockResolvedValue([
    { ...contact("c1", "Ada", "ada@example.test"), portalLinkSentAt: "2026-09-01T00:00:00.000Z" },
  ]);
  await show(update({ audience: "board", recipientContactIds: [] }));
  expect(document.body.textContent).not.toContain("Unticked investors");
});

it("retries a failed recipient directly", async () => {
  rpcMock.retry.mockResolvedValue(update({ status: "sending" }));
  await show(
    update({
      status: "partly_sent",
      deliveries: [
        { contactId: "c1", name: "Ada", state: "sent" },
        { contactId: "c2", name: "Bo", state: "failed" },
      ],
    }),
  );
  expect(document.body.textContent).toContain("Partly sent");
  expect(document.body.textContent).toContain("1 of 2 sent");
  expect(button("Done")).toBeDefined();
  await click(button("Retry"));
  expect(rpcMock.retry).toHaveBeenCalledWith({
    id: "u1",
    contactIds: ["c2"],
    resendUnknown: false,
  });
});

it("asks once before resending an Unknown recipient, and Send again starts a new attempt", async () => {
  rpcMock.retry.mockResolvedValue(update({ status: "sending" }));
  await show(
    update({
      status: "partly_sent",
      deliveries: [
        { contactId: "c1", name: "Ada", state: "sent" },
        { contactId: "c2", name: "Bo", state: "unknown" },
      ],
    }),
  );
  expect(document.body.textContent).toContain("Unknown — check Sent mail");
  await click(button("Retry"));
  expect(rpcMock.retry).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("May already be delivered. Send again?");
  await click(button("Send again"));
  expect(rpcMock.retry).toHaveBeenCalledWith({
    id: "u1",
    contactIds: ["c2"],
    resendUnknown: true,
  });
});

it("closes the resend question without changing anything", async () => {
  await show(
    update({
      status: "partly_sent",
      deliveries: [{ contactId: "c2", name: "Bo", state: "unknown" }],
    }),
  );
  await click(button("Retry"));
  await click(document.querySelector<HTMLElement>("button[aria-label=Close]") ?? undefined);
  expect(document.body.textContent).not.toContain("May already be delivered");
  expect(rpcMock.retry).not.toHaveBeenCalled();
  expect(rpcMock.markDelivered).not.toHaveBeenCalled();
});

it("records an Unknown recipient as Sent with Mark delivered in the footer", async () => {
  rpcMock.markDelivered.mockResolvedValue(update({ status: "sent" }));
  await show(
    update({
      status: "partly_sent",
      deliveries: [
        { contactId: "c1", name: "Ada", state: "sent" },
        { contactId: "c2", name: "Bo", state: "unknown" },
      ],
    }),
  );
  await click(button("Mark delivered"));
  expect(rpcMock.markDelivered).toHaveBeenCalledWith({ id: "u1", contactIds: undefined });
});

it("shows Sending on a disabled button while a send runs", async () => {
  await show(
    update({
      status: "sending",
      deliveries: [
        { contactId: "c1", name: "Ada", state: "sent" },
        { contactId: "c2", name: "Bo", state: "sending" },
      ],
    }),
  );
  const sending = button("Sending") as HTMLButtonElement;
  expect(sending.disabled).toBe(true);
  expect(button("Send")).toBeUndefined();
});

it("pauses send polling while the tab is hidden and resumes on the next tick", async () => {
  vi.useFakeTimers();
  const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
  try {
    await show(update({ status: "sending" }));
    const calls = rpcMock.get.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await advance(5_500);
    expect(rpcMock.get).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await advance(5_000);
    expect(rpcMock.get.mock.calls.length).toBeGreaterThan(calls);
  } finally {
    if (visibility) Object.defineProperty(document, "visibilityState", visibility);
    else Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
  }
});

it("offers Draft with agent only while the body is empty, and reports a failure", async () => {
  await show(update({ body: "" }));
  expect(button("Draft with agent")).toBeDefined();
  rpcMock.agent.mockResolvedValue({ id: "bot1" });
  rpcMock.threadsSend.mockRejectedValue(new Error("No model"));
  await click(button("Draft with agent"));
  expect(rpcMock.threadsSend).toHaveBeenCalledWith(
    expect.objectContaining({ botId: "bot1", text: expect.stringContaining("u1") }),
  );
  expect(document.body.textContent).toContain("No model");
  // The body stays empty.
  expect(button("Draft with agent")).toBeDefined();
});

it("does not offer Draft with agent once there is text", async () => {
  await show(update());
  expect(button("Draft with agent")).toBeUndefined();
});

it("sends the version the fields were read from, then the version the last save returned", async () => {
  vi.useFakeTimers();
  rpcMock.save.mockResolvedValue(update({ updatedAt: "2026-10-01T09:05:00.000Z" }));
  await show(update());
  await click(document.getElementById("to-c2") as HTMLElement);
  await advance(600);
  expect(rpcMock.save).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ updatedAt: "2026-10-01T09:00:00.000Z" }),
  );
  await click(document.getElementById("to-c2") as HTMLElement);
  await advance(600);
  expect(rpcMock.save).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ updatedAt: "2026-10-01T09:05:00.000Z" }),
  );
});

it("takes the server's version when a save is refused, and says Changed elsewhere", async () => {
  vi.useFakeTimers();
  await show(update());
  rpcMock.save.mockRejectedValue(
    new ORPCError("CONFLICT", { message: "This update changed elsewhere." }),
  );
  rpcMock.get.mockResolvedValue(
    update({ body: "Agent version", updatedAt: "2026-10-01T10:00:00.000Z" }),
  );
  await click(document.getElementById("to-c2") as HTMLElement);
  await advance(600);
  await flush();
  expect(document.body.textContent).toContain("Agent version");
  expect(document.body.textContent).toContain("Changed elsewhere");
  expect((document.getElementById("to-c2") as HTMLInputElement).checked).toBe(true);
});

it("stops Send when the save is refused: nothing goes out and no error line shows", async () => {
  vi.useFakeTimers();
  rpcMock.send.mockResolvedValue(update({ status: "sending" }));
  await show(update());
  rpcMock.save.mockRejectedValue(
    new ORPCError("CONFLICT", { message: "This update changed elsewhere." }),
  );
  rpcMock.get.mockResolvedValue(
    update({ body: "Agent version", updatedAt: "2026-10-01T10:00:00.000Z" }),
  );
  await click(button("Send"));
  await flush();
  await advance(UNDO_SEND_MS);
  expect(rpcMock.send).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Changed elsewhere");
  // No error line: the founder sees the other version and presses Send again.
  expect(document.body.textContent).not.toContain("This update changed elsewhere.");
});

async function showBusy(agentBusy: boolean) {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors/updates/u1"]}>
        <UpdateEditor updateId="u1" agentBusy={agentBusy} />
        <NotificationToaster onOpen={() => {}} />
      </MemoryRouter>,
    ),
  );
  await flush();
}

it("picks up the agent's draft when its turn ends, but keeps an unsaved edit", async () => {
  vi.useFakeTimers();
  rpcMock.get.mockResolvedValue(update());
  rpcMock.accounts.mockResolvedValue(gmail);
  await showBusy(true);
  // No local edit: the idle agent's version replaces the fields.
  const loads = rpcMock.get.mock.calls.length;
  rpcMock.get.mockResolvedValue(
    update({ body: "Agent version", updatedAt: "2026-10-01T10:00:00.000Z" }),
  );
  await showBusy(false);
  expect(rpcMock.get.mock.calls.length).toBeGreaterThan(loads);
  expect(document.body.textContent).toContain("Agent version");

  // An unsaved local edit is kept when the agent finishes again.
  const subject = document.getElementById("update-subject") as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    set?.call(subject, "Founder subject");
    subject.dispatchEvent(new Event("input", { bubbles: true }));
  });
  rpcMock.get.mockResolvedValue(update({ body: "Newer agent version" }));
  await showBusy(true);
  await showBusy(false);
  expect((document.getElementById("update-subject") as HTMLInputElement).value).toBe(
    "Founder subject",
  );
  expect(document.body.textContent).not.toContain("Newer agent version");
});
