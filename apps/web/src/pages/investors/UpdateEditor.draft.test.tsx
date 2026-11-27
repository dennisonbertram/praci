// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { InvestorUpdate } from "@rakazo/contracts";
import { THREAD_MESSAGE_MAX_LENGTH } from "@rakazo/contracts";
import { NotificationToaster } from "@rakazo/ui-web";
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
  accounts: vi.fn(),
  contacts: vi.fn(),
  agent: vi.fn(),
  threadsSend: vi.fn(),
  threadsGet: vi.fn(),
  selectedSpaceId: vi.fn(() => "space-a"),
}));
vi.mock("../../lib/rpc", () => ({
  selectedSpaceId: rpcMock.selectedSpaceId,
  rpc: {
    contacts: { list: rpcMock.contacts },
    investors: {
      agent: rpcMock.agent,
      updates: { get: rpcMock.get, save: rpcMock.save, accounts: rpcMock.accounts },
    },
    threads: { send: rpcMock.threadsSend, get: rpcMock.threadsGet },
  },
}));

import { UpdateEditor } from "./UpdateEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const update = (over: Partial<InvestorUpdate> = {}): InvestorUpdate => ({
  id: "u1",
  audience: "investors",
  subject: "Example Co · 2026-09 update",
  period: "2026-09",
  body: "",
  status: "draft",
  recipientContactIds: [],
  fromConnectionId: null,
  deliveries: [],
  sentAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
const click = (target: HTMLElement | undefined) => act(async () => target?.click());

beforeEach(() => {
  i18n.load("en", {});
  i18n.activate("en");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.selectedSpaceId.mockReturnValue("space-a");
  rpcMock.get.mockResolvedValue(update());
  rpcMock.save.mockResolvedValue(update());
  rpcMock.accounts.mockResolvedValue([]);
  rpcMock.contacts.mockResolvedValue([]);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("keeps skipped context out of a later retry", async () => {
  rpcMock.agent.mockResolvedValue({ id: "bot-a" });
  rpcMock.threadsSend.mockRejectedValue(new Error("temporary send failure"));
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors/updates/u1"]}>
        <I18nProvider i18n={i18n}>
          <UpdateEditor updateId="u1" />
          <NotificationToaster onOpen={() => {}} />
        </I18nProvider>
      </MemoryRouter>,
    ),
  );
  await flush();

  await click(button("Draft with agent"));
  const lowlights = document.querySelector(
    'textarea[aria-label="Lowlights"]',
  ) as HTMLTextAreaElement;
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(lowlights, "Do not include this skipped note");
    lowlights.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button("Skip"));
  await flush();
  expect(rpcMock.threadsSend.mock.calls[0]?.[0].text).toContain("Lowlights:\nSkipped: TBD");
  expect(rpcMock.threadsSend.mock.calls[0]?.[0].text).not.toContain(
    "Do not include this skipped note",
  );

  await click(button("Draft with agent"));
  await flush();
  expect(rpcMock.threadsSend).toHaveBeenCalledTimes(2);
  expect(rpcMock.threadsSend.mock.calls[1]?.[0].text).toContain("Lowlights:\nSkipped: TBD");
  expect(rpcMock.threadsSend.mock.calls[1]?.[0].text).not.toContain(
    "Do not include this skipped note",
  );
});

it("pins the draft baseline, agent lookup, and send to the space active when the editor opened", async () => {
  rpcMock.agent.mockResolvedValue({ id: "bot-a" });
  rpcMock.threadsSend.mockRejectedValue(new Error("temporary send failure"));
  rpcMock.selectedSpaceId.mockReturnValue("space-a");
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors/updates/u1"]}>
        <I18nProvider i18n={i18n}>
          <UpdateEditor updateId="u1" />
          <NotificationToaster onOpen={() => {}} />
        </I18nProvider>
      </MemoryRouter>,
    ),
  );
  await flush();
  rpcMock.selectedSpaceId.mockReturnValue("space-b");
  await click(button("Draft with agent"));
  await click(button("Skip"));
  await flush();

  expect(rpcMock.get).toHaveBeenCalledWith({ id: "u1" }, { context: { spaceId: "space-a" } });
  expect(rpcMock.agent).toHaveBeenCalledWith(undefined, { context: { spaceId: "space-a" } });
  expect(rpcMock.threadsSend.mock.calls[0]?.[1]).toEqual({ context: { spaceId: "space-a" } });
});

it("keeps the context dialog open with oversized notes so the founder can fix them", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors/updates/u1"]}>
        <I18nProvider i18n={i18n}>
          <UpdateEditor updateId="u1" />
          <NotificationToaster onOpen={() => {}} />
        </I18nProvider>
      </MemoryRouter>,
    ),
  );
  await flush();
  await click(button("Draft with agent"));
  const lowlights = document.querySelector(
    'textarea[aria-label="Lowlights"]',
  ) as HTMLTextAreaElement;
  const longNote = "x".repeat(THREAD_MESSAGE_MAX_LENGTH + 1);
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(lowlights, longNote);
    lowlights.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button("Continue"));

  expect(document.body.textContent).toContain(
    "This context is too long. Shorten it and try again.",
  );
  expect(document.querySelector('textarea[aria-label="Lowlights"]')).not.toBeNull();
  expect(
    (document.querySelector('textarea[aria-label="Lowlights"]') as HTMLTextAreaElement).value,
  ).toBe(longNote);
  expect(rpcMock.threadsSend).not.toHaveBeenCalled();

  rpcMock.agent.mockResolvedValue({ id: "bot-a" });
  rpcMock.threadsSend.mockRejectedValue(new Error("temporary send failure"));
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(lowlights, "A shorter, valid note.");
    lowlights.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button("Continue"));
  await flush();
  expect(rpcMock.threadsSend).toHaveBeenCalledOnce();
  expect(rpcMock.threadsSend.mock.calls[0]?.[0].text).toContain("A shorter, valid note.");
});

it("saves a pending body clear before reading the baseline for agent drafting", async () => {
  const before = update({ body: "A body to clear." });
  let serverUpdate = before;
  const order: string[] = [];
  rpcMock.get.mockImplementation(async () => {
    order.push("get");
    return serverUpdate;
  });
  rpcMock.save.mockImplementation(async (input: Partial<InvestorUpdate>) => {
    order.push("save");
    serverUpdate = update({ ...serverUpdate, body: input.body ?? serverUpdate.body });
    return serverUpdate;
  });
  rpcMock.agent.mockResolvedValue({ id: "bot-a" });
  rpcMock.threadsSend.mockRejectedValue(new Error("temporary send failure"));
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors/updates/u1"]}>
        <I18nProvider i18n={i18n}>
          <UpdateEditor updateId="u1" />
          <NotificationToaster onOpen={() => {}} />
        </I18nProvider>
      </MemoryRouter>,
    ),
  );
  await flush();
  order.length = 0;
  const paragraph = container.querySelector('[contenteditable="true"] p') as HTMLElement;
  await act(async () => {
    paragraph.textContent = "";
    paragraph.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }),
    );
  });
  await flush();
  await click(button("Draft with agent"));
  await click(button("Skip"));
  await flush();

  expect(order.slice(0, 2)).toEqual(["save", "get"]);
  expect(rpcMock.save).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", body: "" }), {
    context: { spaceId: "space-a" },
  });
  expect(rpcMock.threadsSend).toHaveBeenCalledOnce();
});
