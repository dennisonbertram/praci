// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const mocks = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn(), send: vi.fn() }));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    scratchpad: { update: mocks.update, remove: mocks.remove },
    inbox: { compose: { send: mocks.send } },
  },
}));

import { item } from "../../pages/gtm/fixtures";
import { EmailItemCard } from "./EmailItemCard";

const email = {
  ...item,
  id: "clgtmemail0000000000000001",
  category: "outbound_email" as const,
  channel: "email" as const,
  target: "prospect@example.test",
  notes:
    "Join our beta.\nReply unsubscribe to stop these emails.\n123 Example Street, Sample City, CA 90210",
};
const accounts = [
  { connectionId: "gmail_demo", label: "Demo Gmail", address: "founder@example.test" },
];
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mocks.update.mockImplementation(async (input) => ({
    ...email,
    ...input,
    updatedAt: "2026-10-20T12:00:01.000Z",
  }));
  mocks.send.mockResolvedValue({ status: "sent" });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.resetAllMocks();
});
const render = (value = email) =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <EmailItemCard item={value} accounts={accounts} onChange={() => {}} />
      </MemoryRouter>,
    ),
  );
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === name)!;
const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

it.each(["sent", "unknown", "saved", "failed", "reconnect", "disabled"] as const)(
  "handles %s without a second send on double click",
  async (status) => {
    mocks.send.mockResolvedValue({ status });
    await render();
    await act(async () => {
      button("Approve").click();
      button("Approve").click();
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({
      clientId: email.id,
      connectionId: "gmail_demo",
      to: email.target,
      cc: "",
      bcc: "",
      subject: email.title,
      body: email.notes,
    });
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      itemId: email.id,
      status: "open",
      updatedAt: email.updatedAt,
    });
    expect(mocks.update).toHaveBeenLastCalledWith(
      status === "sent" || status === "unknown"
        ? { itemId: email.id, status: "done", proof: `gmail:${email.id}` }
        : { itemId: email.id, status: "parked" },
    );
    if (!["sent", "unknown"].includes(status))
      expect(host.querySelector('[role="status"]')?.textContent).toBeTruthy();
  },
);

it("disables approval until both checks pass, and saves edits separately from sending", async () => {
  await render({ ...email, notes: "Join our beta." });
  expect(button("Approve").disabled).toBe(true);
  await type(host.querySelector('[aria-label="Message"]')!, email.notes);
  await act(async () => button("Save").click());
  expect(mocks.update).toHaveBeenCalledWith({
    itemId: email.id,
    title: email.title,
    target: email.target,
    notes: email.notes,
  });
  expect(mocks.send).not.toHaveBeenCalled();
});

it("saves a founder address in the body without sending", async () => {
  await render({ ...email, notes: "Reply unsubscribe to stop these emails." });
  await act(async () => button("Add address").click());
  await type(
    host.querySelector('[aria-label="Postal address"]')!,
    "1 Example Street, Sample City, Ireland",
  );
  await act(async () => button("Save address").click());
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      notes:
        "Reply unsubscribe to stop these emails.\n\nPostal address: 1 Example Street, Sample City, Ireland",
    }),
  );
  expect(mocks.send).not.toHaveBeenCalled();
});

it("does not send when the approval version is stale", async () => {
  mocks.update.mockRejectedValue({ code: "CONFLICT" });
  await render();
  await act(async () => button("Approve").click());
  expect(mocks.send).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Changed, review again");
});
