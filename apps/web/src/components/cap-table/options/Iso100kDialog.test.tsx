// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ optionGrants: { list: vi.fn() } }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { Iso100kDialog } from "./Iso100kDialog";
import { demoOptionGrant } from "./option-grant-fixture";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(node);
    await flush();
  });
  return container;
}

const rows = () => [...document.querySelectorAll("tbody tr")];

it("lists ISO value per holder and year and marks the excess over $100,000", async () => {
  rpcMock.optionGrants.list.mockResolvedValue({
    items: [
      demoOptionGrant({
        stakeholderId: "sh-1",
        stakeholderName: "Ada Example",
        exercisePrice: "0.10",
        grantDate: "2024-01-01",
        vestingSchedule: {
          id: "v",
          templateId: null,
          startDate: "2024-01-01",
          totalMonths: 48,
          cliffMonths: 12,
          frequencyMonths: 1,
          tranches: null,
          acceleratedShares: null,
          acceleratedOn: null,
          stoppedOn: null,
          description: "1/48 monthly, 1 year cliff",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      }),
      demoOptionGrant({
        id: "grant-2",
        stakeholderId: "sh-2",
        stakeholderName: "Grace Example",
        quantity: "200000",
        exercisePrice: "1",
        grantDate: "2025-06-01",
        earlyExercise: true,
        vestingSchedule: null,
      }),
    ],
    total: 2,
    page: 1,
    pageSize: 500,
  });
  await mount(<Iso100kDialog onClose={vi.fn()} />);

  expect(rpcMock.optionGrants.list).toHaveBeenCalledWith({ pageSize: 500 });
  expect(rows()).toHaveLength(5);
  expect(rows()[0]?.textContent).toContain("Ada Example");
  expect(rows()[0]?.textContent).toContain("2025");
  expect(rows()[0]?.textContent).toContain("$2,300.00");
  expect(rows()[0]?.querySelector(".text-destructive")).toBeNull();

  const over = rows().find((row) => row.textContent?.includes("Grace Example"));
  expect(over?.textContent).toContain("$200,000.00");
  expect(over?.textContent).toContain("$100,000.00");
  expect(over?.querySelectorAll(".text-destructive")).toHaveLength(2);
});

it("shows an empty line when there are no ISO grants", async () => {
  rpcMock.optionGrants.list.mockResolvedValue({
    items: [demoOptionGrant({ optionType: "nso" })],
    total: 1,
    page: 1,
    pageSize: 500,
  });
  await mount(<Iso100kDialog onClose={vi.fn()} />);
  expect(rows()).toHaveLength(0);
  expect(document.body.textContent).toContain("No ISO grants");
});
