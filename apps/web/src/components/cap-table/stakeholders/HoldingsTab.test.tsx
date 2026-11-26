// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setHideAmounts } from "../../../lib/hide-amounts-preference";

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
      convertibles: {
        list: () =>
          page([
            {
              id: "safe-1",
              createdAt: "2019-03-01T00:00:00.000Z",
              updatedAt: "2019-03-01T00:00:00.000Z",
              label: "SAFE-1",
              stakeholderId: "sh-1",
              blockId: null,
              kind: "safe",
              principalCents: "1234500",
              issueDate: "2019-03-01",
              stakeholderName: "Alder Person",
              blockName: null,
              interestAccruedCents: null,
              totalCents: null,
            },
          ]),
      },
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
  setHideAmounts(false);
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
  expect(container.textContent).toContain("$12,345");
});

it("masks convertible principal when hide amounts is enabled and updates live", async () => {
  setHideAmounts(false);
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

  expect(container.textContent).toContain("$12,345");

  await act(async () => setHideAmounts(true));
  expect(container.textContent).toContain("$•••");
  expect(container.textContent).not.toContain("$12,345");
  expect(container.textContent).toContain("Mar 1, 2019");
  expect(container.textContent).toContain("6,000,000");

  await act(async () => setHideAmounts(false));
  expect(container.textContent).toContain("$12,345");
});
