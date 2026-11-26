// @vitest-environment jsdom

import type { BillingStatus } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ status: vi.fn(), portal: vi.fn() }));
const translate = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((result, part, i) => result + part + String(values[i] ?? ""), ""),
);
vi.mock("../lib/rpc", () => ({ rpc: { billing: { status: api.status, portal: api.portal } } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: translate,
    i18n: { locale: "en" },
  }),
  Trans: ({ children }: { children: string }) => children,
  Plural: ({ value, other }: { value: number; other: string }) => other.replace("#", String(value)),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots = new Set<ReturnType<typeof createRoot>>();
beforeEach(() => {
  api.status.mockReset();
  api.portal.mockReset();
});
afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
    roots.clear();
  });
});

const base: BillingStatus = {
  access: true,
  canManage: true,
  trialAvailable: false,
  trialDays: 14,
  state: "active",
  price: { amount: 2000, currency: "usd", interval: "month", intervalCount: 1 },
  seats: 1,
  trialEndsAt: null,
  currentPeriodEndsAt: null,
  cancelAtPeriodEnd: false,
  hasCustomer: true,
};

async function panelText(status: BillingStatus) {
  api.status.mockResolvedValue(status);
  const { BillingSettingsPanel } = await import("./BillingSettingsPanel");
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.add(root);
  await act(async () => {
    root.render(<BillingSettingsPanel />);
  });
  return container.textContent ?? "";
}

it("shows the total for several seats", async () => {
  const text = await panelText({ ...base, seats: 3 });
  expect(text).toContain("$60");
  expect(text).toContain("3 seats");
});

it("shows the unit price for one seat", async () => {
  const text = await panelText(base);
  expect(text).toContain("$20");
  expect(text).not.toContain("seat");
});

it("quietly refreshes the plan when the panel regains focus", async () => {
  api.status.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, seats: 3 });
  const { BillingSettingsPanel } = await import("./BillingSettingsPanel");
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.add(root);
  await act(async () => {
    root.render(<BillingSettingsPanel />);
  });
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("3 seats");
  expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  await act(async () => root.unmount());
});

it("keeps the current plan when a focus refresh fails", async () => {
  api.status.mockResolvedValueOnce(base).mockRejectedValueOnce(new Error("offline"));
  const { BillingSettingsPanel } = await import("./BillingSettingsPanel");
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.add(root);
  await act(async () => {
    root.render(<BillingSettingsPanel />);
  });
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("$20");
  expect(container.textContent).not.toContain("Could not load billing");
  expect(container.textContent).not.toContain("Try again");
  await act(async () => root.unmount());
});

it("retries a failed status load and shows the plan after success", async () => {
  api.status.mockRejectedValueOnce(new Error("offline"));
  const { BillingSettingsPanel } = await import("./BillingSettingsPanel");
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.add(root);
  await act(async () => {
    root.render(<BillingSettingsPanel />);
  });

  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeDefined();
  let resolveStatus!: (status: BillingStatus) => void;
  api.status.mockReturnValueOnce(
    new Promise<BillingStatus>((resolve) => {
      resolveStatus = resolve;
    }),
  );
  await act(async () => retry?.click());
  expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  await act(async () => resolveStatus({ ...base, seats: 3 }));
  expect(container.textContent).toContain("$60");
  expect(container.textContent).toContain("3 seats");
  expect(container.textContent).not.toContain("Could not load billing");
  await act(async () => root.unmount());
});

it("shows portal errors without a status retry", async () => {
  api.status.mockResolvedValue({ ...base, hasCustomer: true });
  api.portal.mockRejectedValue(new Error("offline"));
  const { BillingSettingsPanel } = await import("./BillingSettingsPanel");
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.add(root);
  await act(async () => {
    root.render(<BillingSettingsPanel />);
  });
  const manage = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Manage",
  );
  await act(async () => manage?.click());
  expect(container.textContent).toContain("Could not open billing");
  expect(container.textContent).not.toContain("Try again");
  await act(async () => root.unmount());
});
