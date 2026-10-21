// @vitest-environment jsdom

import type { MeetingsStatus } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));

const meetings = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
const connections = vi.hoisted(() => ({ createAgent: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { meetings, connections } }));

import { GranolaMeetingsCard, granolaLine } from "./GranolaMeetingsCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: NonNullable<MeetingsStatus> = {
  connectionId: "conn_1",
  status: "connected",
  syncedThrough: "2026-10-20T10:00:00Z",
  lastSyncedAt: null,
  syncedCount: 3,
  consentOff: false,
  agentBotId: "bot_1",
};

let container: HTMLDivElement;
const onChanged = vi.fn();
const onOpenAiDataSharing = vi.fn();

async function show(status: MeetingsStatus, bothRoutes = false) {
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <GranolaMeetingsCard
          status={status}
          bothRoutes={bothRoutes}
          agentName="Granola agent"
          onChanged={onChanged}
          onOpenAiDataSharing={onOpenAiDataSharing}
        />
      </MemoryRouter>,
    ),
  );
}
const text = () => container.textContent ?? "";
const field = () => container.querySelector("input") as HTMLInputElement;
const button = (label: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  ) as HTMLButtonElement;

async function type(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(field(), value);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.append(container);
});

it("shows a password field that is not submitted on typing or paste", async () => {
  await show(null);
  expect(field().type).toBe("password");
  expect(field().autocomplete).toBe("off");
  expect(field().placeholder).toBe("");
  expect(text()).toContain("Granola API key");
  expect(text()).toContain("Business plan");
  expect(text()).toContain("Sends your meeting notes and transcripts to your AI model.");
  await type("grn_key");
  await act(async () => {
    field().dispatchEvent(new Event("paste", { bubbles: true }));
  });
  expect(meetings.connect).not.toHaveBeenCalled();
});

it("links to Granola's key settings while the field is empty, not once a key is typed", async () => {
  await show(null);
  const link = container.querySelector("a[href^='https://docs.granola.ai']") as HTMLAnchorElement;
  expect(link.textContent).toBe("Get a key");
  expect(link.target).toBe("_blank");
  expect(link.rel).toContain("noopener");
  await type("grn_key");
  expect(container.querySelector("a[href^='https://docs.granola.ai']")).toBeNull();
});

it("connects with the typed key, shows Connecting and refreshes", async () => {
  let finish = () => {};
  meetings.connect.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
  await show(null);
  await type("grn_key");
  await act(async () => button("Connect").click());
  expect(meetings.connect).toHaveBeenCalledWith({ apiKey: "grn_key" });
  expect(text()).toContain("Connecting…");
  await act(async () => finish());
  expect(onChanged).toHaveBeenCalled();
});

it("shows the rejection after a failed Connect, keeps the key link, and clears on edit", async () => {
  meetings.connect.mockRejectedValue(new Error("Granola rejected this key"));
  await show(null);
  await type("bad");
  await act(async () => button("Connect").click());
  expect(text()).toContain("Granola rejected this key");
  expect(container.querySelector("a[href^='https://docs.granola.ai']")).not.toBeNull();
  expect(field().value).toBe("bad");
  await type("bad2");
  expect(text()).not.toContain("Granola rejected this key");
});

it("keeps the field value when Granola cannot be reached", async () => {
  meetings.connect.mockRejectedValue(new Error("Could not reach Granola"));
  await show(null);
  await type("grn_key");
  await act(async () => button("Connect").click());
  expect(text()).toContain("Could not reach Granola");
  expect(field().value).toBe("grn_key");
});

it("links Synced to the stored-meetings list and shows no key field while connected", async () => {
  await show(base);
  const link = [...container.querySelectorAll("a")].find(
    (a) => a.textContent === "Synced 3 meetings",
  );
  expect(link?.getAttribute("href")).toBe("/app/integrations/granola/meetings");
  expect(field()).toBeNull();
  expect(text()).not.toContain("Sends your meeting notes");
  expect(text()).not.toContain("Sign-in");
  expect(text()).not.toContain("API key");
  expect(text()).toContain("Granola agent");
});

it("reads Syncing until the first sync finishes", async () => {
  await show({ ...base, syncedThrough: null });
  expect(text()).toContain("Syncing");
  expect(text()).not.toContain("Synced");
});

it("shows the relative time only when the sync is late", async () => {
  await show({ ...base, lastSyncedAt: new Date(Date.now() - 3 * 3_600_000).toISOString() });
  expect(text()).toContain("3h ago");
});

it("reads Reconnect needed with a warning dot, no Synced and no error line", async () => {
  await show({ ...base, status: "needs_reconnect" });
  expect(text()).toContain("Reconnect needed");
  expect(text()).not.toContain("Synced");
  expect(container.querySelector("[data-tone='warning']")).not.toBeNull();
  expect(container.querySelector("[data-tone='success']")).toBeNull();
  expect(container.querySelector("[role='alert']")).toBeNull();
  expect(field()).not.toBeNull();
  expect(text()).toContain("Sends your meeting notes and transcripts to your AI model.");
  expect(button("Disconnect")).toBeDefined();
});

it("reads AI data sharing off instead of Synced, linking to settings", async () => {
  await show({ ...base, consentOff: true });
  expect(text()).not.toContain("Synced");
  await act(async () => button("AI data sharing off").click());
  expect(onOpenAiDataSharing).toHaveBeenCalled();
});

it("disconnects and then shows the keep sentence with the agent link and consent sentence", async () => {
  meetings.disconnect.mockResolvedValue({ ok: true });
  await show(base);
  await act(async () => button("Disconnect").click());
  expect(meetings.disconnect).toHaveBeenCalled();
  expect(onChanged).toHaveBeenCalled();
  await show({ ...base, status: "disconnected" });
  expect(text()).toContain("Praci keeps your meetings and to-dos.");
  expect(text()).toContain("Granola agent");
  expect(text()).toContain("Sends your meeting notes and transcripts to your AI model.");
  expect(field().value).toBe("");
});

it("labels the route only while both routes are connected", async () => {
  await show(base, true);
  expect(text()).toContain("API key");
});

it("offers Create agent only while connected and no agent exists", async () => {
  connections.createAgent.mockResolvedValue({ botId: "bot_9" });
  await show({ ...base, agentBotId: null });
  await act(async () => button("Create agent").click());
  expect(connections.createAgent).toHaveBeenCalledWith({ connectionId: "conn_1" });
  await show({ ...base, agentBotId: null, status: "needs_reconnect" });
  expect(button("Create agent")).toBeUndefined();
});

it("orders the tile line: reconnect, then AI data sharing off, then the key status", () => {
  expect(granolaLine({ ...base, status: "needs_reconnect", consentOff: true })).toBe("reconnect");
  expect(granolaLine({ ...base, consentOff: true })).toBe("consent");
  expect(granolaLine({ ...base, syncedThrough: null })).toBe("syncing");
  expect(granolaLine(base)).toBe("synced");
  expect(granolaLine({ ...base, status: "disconnected" })).toBeNull();
  expect(granolaLine(null)).toBeNull();
});
