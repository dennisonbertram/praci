// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const people = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: { brexCards: { people }, threads: { send } },
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  plural: (n: number, forms: { one: string; other: string }) =>
    forms[n === 1 ? "one" : "other"].replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BrexPeople } from "./BrexPeople";
import { peopleFixture } from "./fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
const flush = () => act(async () => {});
const buttonIn = (scope: ParentNode, label: string) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;
const click = (button: HTMLElement) => act(async () => button.click());
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const rowOf = (name: string) =>
  [...container.querySelectorAll("tbody tr")].find((row) => row.textContent?.includes(name))!;

async function mount(data = peopleFixture) {
  people.mockResolvedValue(data);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/brex/people"]}>
        <BrexPeople />
        <Where />
      </MemoryRouter>,
    ),
  );
  await flush();
}

beforeEach(() => {
  people.mockReset();
  send.mockReset();
  send.mockResolvedValue({ taskId: "t", runId: "r", seq: 1 });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("sends the exact Offboard message to the Brex agent, then opens its chat", async () => {
  await mount();
  await click(buttonIn(rowOf("Ada Example"), "Offboard"));
  expect(dialog().textContent).toContain("Every change waits for your approval.");
  expect(dialog().textContent).not.toContain("Turn off Brex user");
  await click(buttonIn(dialog(), "Request offboarding"));
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0]?.[0]).toMatchObject({
    botId: "bot_brex",
    text: "Offboard Ada Example: lock their cards card_ops, cancel card_ops, remove them from limits limit_cloud.",
  });
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/app/bot_brex");
});

it("disables Offboard when changes are off", async () => {
  await mount({ ...peopleFixture, writesEnabled: false });
  const button = buttonIn(rowOf("Ada Example"), "Offboard");
  expect(button.disabled).toBe(true);
  await click(button);
  expect(send).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("hides Cards and Limits columns on phones", async () => {
  await mount();
  for (const name of ["Cards", "Limits"]) {
    const th = [...container.querySelectorAll("th")].find((h) => h.textContent === name)!;
    expect(th.className).toContain("hidden");
    expect(th.className).toContain("@lg:table-cell");
  }
});
