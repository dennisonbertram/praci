// @vitest-environment jsdom

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
        retry: rpcMock.retry,
        markDelivered: rpcMock.markDelivered,
        accounts: rpcMock.accounts,
      },
    },
    threads: { send: rpcMock.threadsSend },
  },
}));

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

async function show(initial: InvestorUpdate, accounts: unknown[] = gmail) {
  rpcMock.get.mockResolvedValue(initial);
  rpcMock.accounts.mockResolvedValue(accounts);
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
  expect(rpcMock.send).toHaveBeenCalledWith({ id: "u1" });
});

it("sends without asking when nothing is TBD", async () => {
  rpcMock.send.mockResolvedValue(update({ status: "sending" }));
  await show(update());
  await click(button("Send"));
  expect(document.body.textContent).not.toContain("TBD left");
  expect(rpcMock.send).toHaveBeenCalledOnce();
});

it("shows a sent update read-only with no footer button", async () => {
  await show(update({ status: "sent", sentAt: "2026-10-02T09:00:00.000Z" }));
  expect((document.getElementById("update-subject") as HTMLInputElement).disabled).toBe(true);
  expect(document.querySelector("[contenteditable=false]")).not.toBeNull();
  expect(button("Send")).toBeUndefined();
  expect(button("Done")).toBeUndefined();
  expect(document.body.textContent).toContain("Sent");
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

it("hides the To list without Gmail and offers only Connect Gmail to send, for either audience", async () => {
  for (const audience of ["investors", "board"] as const) {
    await show(update({ audience }), []);
    expect(document.body.textContent).not.toContain("To");
    expect(button("Connect Gmail to send")).toBeDefined();
    expect(button("Send")).toBeUndefined();
    expect(button("Post to portal")).toBeUndefined();
  }
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
