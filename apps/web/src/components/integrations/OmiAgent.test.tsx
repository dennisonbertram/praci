// @vitest-environment jsdom

import { mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const access = vi.hoisted(() => vi.fn());
const setAccess = vi.hoisted(() => vi.fn());
const setAgentAccess = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: { connections: { access, setAccess, setAgentAccess, setExclusive: vi.fn() } },
}));

import { OmiAgent } from "./OmiPage";
import type { IntegrationsData } from "./useIntegrations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

const bots = [
  { id: "omi", name: "Omi agent", color: "#000", spawnKey: null },
  { id: "ada", name: "Ada", color: "#000", spawnKey: null },
  { id: "e1", name: "One", color: "#000", spawnKey: mailThreadAgentSpawnKey("c", "t1") },
  { id: "e2", name: "Two", color: "#000", spawnKey: mailThreadAgentSpawnKey("c", "t2") },
];

async function show(initial: { allAgents: boolean; botIds: string[]; agentShared?: boolean }) {
  const full = { agentShared: true, ...initial };
  access.mockResolvedValue(full);
  // Like the server: None keeps sharing on.
  setAccess.mockImplementation(async (input: { allAgents: boolean; botIds: string[] }) => ({
    ...input,
    agentShared: full.agentShared,
  }));
  setAgentAccess.mockResolvedValue(full);
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <OmiAgent
          connectionId="c1"
          agentBotId="omi"
          data={{ bots } as unknown as IntegrationsData}
        />
      </MemoryRouter>,
    ),
  );
  return container;
}

it("Email chats off in Omi revokes every chat, not only the last one", async () => {
  const container = await show({ allAgents: true, botIds: [] });
  await act(async () =>
    container.querySelector<HTMLElement>('[aria-label="Email chats can use Omi"]')?.click(),
  );
  expect(setAgentAccess.mock.calls.map(([call]) => [call.botId, call.on])).toEqual([
    ["e1", false],
    ["e2", false],
  ]);
});

it("All and None each save once, and None keeps the Omi agent", async () => {
  setAccess.mockClear();
  const container = await show({ allAgents: false, botIds: ["omi", "ada"] });
  const press = (name: string) =>
    act(async () =>
      [...container.querySelectorAll("button")].find((b) => b.textContent === name)?.click(),
    );
  await press("All");
  expect(setAccess.mock.calls).toEqual([[{ connectionId: "c1", allAgents: true, botIds: [] }]]);
  setAccess.mockClear();
  await press("None");
  expect(setAccess.mock.calls).toEqual([
    [{ connectionId: "c1", allAgents: false, botIds: ["omi"] }],
  ]);
});

it("None keeps Let other agents use Omi on and the list visible, with the other agents off", async () => {
  const container = await show({ allAgents: false, botIds: ["omi", "ada"], agentShared: true });
  await act(async () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === "None")?.click(),
  );
  expect(container.querySelector<HTMLInputElement>("#omi-shared")?.checked).toBe(true);
  expect(container.textContent).toContain("Which agents can use");
  expect(
    container.querySelector('[aria-label="Ada can use Omi"]')?.getAttribute("aria-checked"),
  ).toBe("false");
});

it("a failed save refetches only after the newer queued save has finished", async () => {
  setAgentAccess.mockReset();
  let failFirst: (error: Error) => void = () => undefined;
  let finishSecond: () => void = () => undefined;
  const all = ["omi", "ada", "e1", "e2"];
  const container = await show({ allAgents: false, botIds: all });
  setAgentAccess.mockReset();
  setAgentAccess.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        failFirst = reject;
      }),
  );
  setAgentAccess.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishSecond = () => resolve({ allAgents: false, botIds: all, agentShared: true });
      }),
  );
  setAgentAccess.mockResolvedValue({ allAgents: false, botIds: all, agentShared: true });
  access.mockClear();
  const sw = (name: string) =>
    container.querySelector<HTMLElement>(`[aria-label="${name} can use Omi"]`)!;
  await act(async () => sw("Ada").click());
  await act(async () => sw("Email chats").click()); // queued behind the first
  await act(async () => failFirst(new Error("boom")));
  // The second save is still running, so the failure must not reset the list from the server yet.
  expect(access).not.toHaveBeenCalled();
  await act(async () => finishSecond());
  expect(access).toHaveBeenCalledTimes(1);
});

it("a failed load shows Could not load, and Try again enables the controls", async () => {
  access.mockRejectedValueOnce(new Error("offline"));
  const container = await show({ allAgents: false, botIds: ["omi"] });
  expect(container.textContent).toContain("Could not load");
  const toggle = () => container.querySelector<HTMLElement>("#omi-shared");
  expect(toggle()?.hasAttribute("disabled")).toBe(true);
  await act(async () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === "Try again")?.click(),
  );
  expect(container.textContent).not.toContain("Could not load");
  expect(toggle()?.hasAttribute("disabled")).toBe(false);
});
