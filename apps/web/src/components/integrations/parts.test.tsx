// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import { inboxAgentSpawnKey, mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { AgentToggleList } from "./parts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

const bot = (id: string, name: string, spawnKey: string | null) =>
  ({ id, name, color: "#000", spawnKey }) as unknown as Bot;

async function renderEmailRow(on: (id: string) => boolean) {
  const container = document.createElement("div");
  document.body.append(container);
  const onToggle = vi.fn();
  const bots = [
    bot("chief", "Chief", null),
    bot("e1", "Legal notice", mailThreadAgentSpawnKey("conn", "t1")),
    bot("e2", "Great meeting", mailThreadAgentSpawnKey("conn", "t2")),
  ];
  await act(async () =>
    createRoot(container).render(
      <AgentToggleList bots={bots} appName="Mercury" isOn={on} onToggle={onToggle} />,
    ),
  );
  const row = container.querySelector<HTMLElement>('[aria-label="Email chats can use Mercury"]');
  return { container, onToggle, row };
}

it("folds every per-email chat into one Email chats row with one switch", async () => {
  const { container } = await renderEmailRow(() => true);
  expect(container.querySelectorAll('[role="switch"]')).toHaveLength(2);
  expect(container.textContent).toContain("Email chats");
  expect(container.textContent).not.toContain("Legal notice");
});

it("mixed access shows Some and one click turns all email chats off", async () => {
  const { container, onToggle, row } = await renderEmailRow((id) => id !== "e2");
  expect(container.textContent).toContain("Some");
  expect(row?.getAttribute("aria-checked")).toBe("true");
  await act(async () => row?.click());
  expect(onToggle.mock.calls).toEqual([
    ["e1", false],
    ["e2", false],
  ]);
});

it("all on shows no Some and turns all off; all off turns all on", async () => {
  const on = await renderEmailRow(() => true);
  expect(on.container.textContent).not.toContain("Some");
  await act(async () => on.row?.click());
  expect(on.onToggle.mock.calls).toEqual([
    ["e1", false],
    ["e2", false],
  ]);
  const off = await renderEmailRow(() => false);
  expect(off.row?.getAttribute("aria-checked")).toBe("false");
  await act(async () => off.row?.click());
  expect(off.onToggle.mock.calls).toEqual([
    ["e1", true],
    ["e2", true],
  ]);
});

function renderAllNone(props: {
  on: string[];
  ownerBotId?: string;
  saving?: boolean;
  everyone?: boolean;
  extra?: Bot[];
  ownerKey?: string | null;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const onSetAll = vi.fn();
  const bots = [
    bot("chief", "Chief", props.ownerKey ?? null),
    bot("ada", "Ada", null),
    ...(props.extra ?? []),
  ];
  act(() =>
    createRoot(container).render(
      <AgentToggleList
        bots={bots}
        appName="Mercury"
        isOn={(id) => props.on.includes(id)}
        onToggle={() => undefined}
        onSetAll={onSetAll}
        ownerBotId={props.ownerBotId}
        saving={props.saving}
        everyone={props.everyone}
      />,
    ),
  );
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  return { onSetAll, button };
}

it("All and None call onSetAll once and disable at their own extreme", () => {
  const some = renderAllNone({ on: ["chief"], ownerBotId: "chief" });
  expect(some.button("All").disabled).toBe(false);
  expect(some.button("None").disabled).toBe(true); // only the owner is on
  act(() => some.button("All").click());
  expect(some.onSetAll.mock.calls).toEqual([[true]]);

  const every = renderAllNone({ on: ["chief", "ada"], ownerBotId: "chief" });
  // Everyone is on but access is a list: All still switches it to "all agents", future ones included.
  expect(every.button("All").disabled).toBe(false);
  act(() => every.button("None").click());
  expect(every.onSetAll.mock.calls).toEqual([[false]]);

  const noOwner = renderAllNone({ on: [] });
  expect(noOwner.button("None").disabled).toBe(true);
});

it("All and None wait for a save in flight", () => {
  const view = renderAllNone({ on: ["ada"], ownerBotId: "chief", saving: true });
  expect(view.button("All").disabled).toBe(true);
  expect(view.button("None").disabled).toBe(true);
});

it("email chats do not keep None enabled when the Inbox agent owns the connection", () => {
  const chat = bot("e1", "Re: hi", mailThreadAgentSpawnKey("conn", "t1"));
  const view = renderAllNone({
    on: ["chief", "e1"],
    ownerBotId: "chief",
    extra: [chat],
    ownerKey: inboxAgentSpawnKey("u1"),
  });
  expect(view.button("None").disabled).toBe(true);
});

it("with access stored as all agents, All is done and None stays available", () => {
  const view = renderAllNone({ on: ["chief"], ownerBotId: "chief", everyone: true });
  expect(view.button("All").disabled).toBe(true);
  expect(view.button("None").disabled).toBe(false);
});

it("sets the Inbox agent and Email chats apart from the other agents on a mail connection", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const bots = [
    bot("ada", "Ada", null),
    bot("e1", "Legal notice", mailThreadAgentSpawnKey("conn", "t1")),
    bot("inbox", "Inbox agent", inboxAgentSpawnKey("u1")),
    bot("chief", "Chief", null),
  ];
  await act(async () =>
    createRoot(container).render(
      <AgentToggleList
        bots={bots}
        appName="Gmail"
        isOn={(id) => id === "inbox"}
        onToggle={() => undefined}
        onSetAll={() => undefined}
        ownerBotId="inbox"
      />,
    ),
  );
  const labels = [...container.querySelectorAll('[role="switch"]')].map((el) =>
    el.getAttribute("aria-label"),
  );
  expect(labels).toEqual([
    "Inbox agent can use Gmail",
    "Email chats can use Gmail",
    "Ada can use Gmail",
    "Chief can use Gmail",
  ]);
  expect(container.textContent).toContain("Other agents");
  // Without a mail owner nothing is grouped and no subheading shows.
  const plain = await renderEmailRow(() => true);
  expect(plain.container.textContent).not.toContain("Other agents");
});
