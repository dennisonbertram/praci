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

it("folds every per-email chat into one Email chats row with one switch", async () => {
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
      <AgentToggleList
        bots={bots}
        appName="Mercury"
        isOn={(id) => id !== "e2"}
        onToggle={onToggle}
      />,
    ),
  );
  expect(container.querySelectorAll('[role="switch"]')).toHaveLength(2);
  expect(container.textContent).toContain("Email chats");
  expect(container.textContent).not.toContain("Legal notice");
  // One chat is off, so the row reads off; turning it on turns on all of them.
  const row = container.querySelector<HTMLElement>('[aria-label="Email chats can use Mercury"]');
  expect(row?.getAttribute("aria-checked")).toBe("false");
  await act(async () => row?.click());
  expect(onToggle.mock.calls).toEqual([
    ["e1", true],
    ["e2", true],
  ]);
});
