// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import { mailThreadAgentSpawnKey } from "@rakazo/contracts";
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
