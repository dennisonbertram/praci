// @vitest-environment jsdom

import type { BrexActivity as BrexActivityData } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const activity = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { brexCards: { activity } } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: String.raw,
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replaceAll("#", String(count)),
}));

import { BrexActivity } from "./BrexActivity";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Fixed timestamps keep the rendered times deterministic.
const data = (activities: BrexActivityData["activities"]): BrexActivityData => ({
  serverId: "server_brex",
  agentBotId: "bot_brex",
  writesEnabled: true,
  activities,
});
const two = data([
  {
    effectId: "eff_1",
    at: "2026-11-06T14:22:00.000Z",
    action: "lock_card",
    target: "Ops card",
    status: "succeeded",
  },
  {
    effectId: "eff_2",
    at: "2026-11-05T09:00:00.000Z",
    action: "update_expense_memo",
    target: "Blue Bottle",
    status: "denied",
  },
]);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
async function mount(value: BrexActivityData) {
  activity.mockResolvedValue(value);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/brex/activity"]}>
        <BrexActivity />
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(container.textContent).toMatch(/Activity|No changes yet/));
}
const bodyRows = () => [...container.querySelectorAll("tbody tr")];

beforeEach(() => activity.mockReset());
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("renders exactly the activities the RPC returns and nothing else", async () => {
  await mount(two);
  await vi.waitFor(() => expect(bodyRows()).toHaveLength(2));
  expect(container.textContent).toContain("Ops card");
  expect(container.textContent).toContain("Blue Bottle");
  expect(container.textContent).toContain("Lock card");
  expect(container.textContent).toContain("Edit memo");
  // The plan removed the approver column: there is no such header.
  expect(container.textContent).not.toContain("Approved by");
});

it("shows nothing when the RPC returns no activities, and never invents rows", async () => {
  await mount(data([]));
  await vi.waitFor(() => expect(container.textContent).toContain("No changes yet."));
  expect(bodyRows()).toHaveLength(0);
});

it("hides the Action and Result filters and the sort when there are no rows", async () => {
  await mount(data([]));
  await vi.waitFor(() => expect(container.textContent).toContain("No changes yet."));
  expect(container.textContent).not.toContain("Action");
  expect(container.textContent).not.toContain("Result");
});
