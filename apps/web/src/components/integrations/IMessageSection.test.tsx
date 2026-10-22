// @vitest-environment jsdom

import type { MessagingSetupState } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const messagingSetup = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), test: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { messagingSetup } }));

import { IMessageSection } from "./IMessageSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = (
  over: Partial<MessagingSetupState["providers"][number]> = {},
): MessagingSetupState => ({
  canConfigure: true,
  providers: [
    {
      id: "photon",
      fields: {},
      configured: false,
      active: false,
      webhookUrl: "https://rakazo.example/api/v1/messaging/webhook/photon",
    },
    {
      id: "bluebubbles",
      fields: {
        serverUrl: { source: "saved", value: "http://192.168.1.20:1234/" },
        password: { source: "saved" },
        webhookToken: { source: "server" },
      },
      configured: true,
      active: false,
      webhookUrl: "https://rakazo.example/api/v1/messaging/webhook/bluebubbles?token=fake",
      ...over,
    },
  ],
});

let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

async function mount(next: MessagingSetupState) {
  messagingSetup.get.mockResolvedValue(next);
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<IMessageSection />));
  return host;
}

it("shows both tiles to the owner and nothing to anyone else", async () => {
  const host = await mount(state());
  expect(host.textContent).toContain("iMessage");
  const marks = [...host.querySelectorAll("[data-testid=app-logo]")].map((el) => el.innerHTML);
  expect(new Set(marks).size).toBe(marks.length);
  expect(host.textContent).toContain("Through BlueBubbles on your Mac");
  expect(host.textContent).toContain("Needs a server restart");
  act(() => root?.unmount());
  host.remove();
  const other = await mount({ canConfigure: false, providers: [] });
  expect(other.textContent).toBe("");
});

it("shows saved and server-set secrets without values, and warns about a public URL", async () => {
  await mount(state());
  const edit = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Edit iMessage on your Mac"]',
  )!;
  await act(async () => edit.click());
  const dialog = document.body.textContent ?? "";
  expect(dialog).toContain("Saved");
  expect(dialog).toContain("Set by server");
  expect(dialog).not.toContain("Anyone who can reach this address");
  const url = document.querySelector<HTMLInputElement>('input[aria-label="Server URL"]')!;
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(url, "https://bb.example.com");
    url.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(document.body.textContent).toContain(
    "Anyone who can reach this address can talk to your Mac's server. Use a private network or a tunnel.",
  );
  expect(document.querySelector<HTMLInputElement>("#messaging-webhook-url")!.value).toContain(
    "token=",
  );
});

it("reports a failed connection test", async () => {
  await mount(state());
  messagingSetup.test.mockResolvedValue({ ok: false, error: "BlueBubbles /ping returned 401" });
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('button[aria-label="Edit iMessage on your Mac"]')!
      .click(),
  );
  const test = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Test connection",
  )!;
  await act(async () => test.click());
  expect(document.body.textContent).toContain("BlueBubbles /ping returned 401");
});

const openEdit = async () =>
  act(async () =>
    document
      .querySelector<HTMLButtonElement>('button[aria-label="Edit iMessage on your Mac"]')!
      .click(),
  );
const button = (name: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === name)!;

it("ends a hung connection test with an error", async () => {
  vi.useFakeTimers();
  try {
    await mount(state());
    messagingSetup.test.mockReturnValue(new Promise(() => undefined));
    await openEdit();
    await act(async () => button("Test connection").click());
    expect(document.body.textContent).toContain("Testing…");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(document.body.textContent).toContain("No response from the server. Check the address.");
    expect(button("Test connection")).toBeDefined();
  } finally {
    vi.useRealTimers();
  }
});

it("labels every field and the webhook URL, and shows Done after a save", async () => {
  await mount(state());
  messagingSetup.save.mockResolvedValue({ ok: true });
  await openEdit();
  const labels = [...document.querySelectorAll("label")].map((l) => l.textContent);
  expect(labels).toContain("Server URL");
  expect(labels).toContain("Paste this into BlueBubbles");
  await act(async () => {
    document.querySelector<HTMLFormElement>("form")!.requestSubmit();
  });
  expect(document.body.textContent).toContain("Restart the Praci server");
  expect(button("Done")).toBeDefined();
  expect([...document.querySelectorAll("button")].some((b) => b.textContent === "Cancel")).toBe(
    false,
  );
});
