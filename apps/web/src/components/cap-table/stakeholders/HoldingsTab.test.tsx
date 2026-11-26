// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const page = (items: unknown[]) => Promise.resolve({ items, total: items.length });
vi.mock("../../../lib/rpc", () => ({
  rpc: {
    equity: {
      certificates: {
        list: () =>
          page([
            {
              id: "c1",
              label: "CS-1",
              shareClassName: "Common",
              quantity: "6000000",
              issueDate: "2019-03-01",
              status: "outstanding",
            },
          ]),
      },
      convertibles: { list: () => page([]) },
      optionGrants: { list: () => page([]) },
    },
  },
}));

import { HoldingsTab } from "./StakeholderProfile";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
});

it("shows holding dates like every other tab", async () => {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter>
        <HoldingsTab stakeholderId="sh-1" />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.textContent).toContain("CS-1");
  expect(container.textContent).toContain("Mar 1, 2019");
  expect(container.textContent).not.toContain("2019-03-01");
});
