// @vitest-environment jsdom

import type { BillingStatus } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((result, part, i) => result + part + String(values[i] ?? ""), ""),
    i18n: { locale: "en" },
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./Auth", () => ({
  AuthFrame: ({
    title,
    children,
    onSubmit,
  }: {
    title: string;
    children: ReactNode;
    onSubmit?: (event: React.FormEvent) => void;
  }) => (
    <main>
      <h1>{title}</h1>
      <form onSubmit={onSubmit}>{children}</form>
    </main>
  ),
  submitClass: "",
}));
const { checkout, portal } = vi.hoisted(() => ({ checkout: vi.fn(), portal: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { billing: { checkout, portal } } }));
vi.mock("../lib/sign-out", () => ({ signOutAndLeave: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const status: BillingStatus = {
  access: false,
  canManage: true,
  trialAvailable: true,
  trialDays: 14,
  state: "none",
  price: { amount: 2000, currency: "usd", interval: "month", intervalCount: 1 },
  seats: 3,
  trialEndsAt: null,
  currentPeriodEndsAt: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
};

async function renderPaywall(overrides: Partial<BillingStatus> = {}) {
  const { PaywallPage } = await import("./Paywall");
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PaywallPage status={{ ...status, ...overrides }} />
      </MemoryRouter>,
    );
  });
  return {
    container,
    unmount: async () => act(async () => root.unmount()),
  };
}

it("shows the total price for several seats", async () => {
  const { container, unmount } = await renderPaywall();
  expect(container.querySelector("h1")?.textContent).toContain("$60");
  await unmount();
});

it("shows an error and re-enables Subscribe when checkout fails", async () => {
  checkout.mockRejectedValueOnce(new Error("offline"));
  const { container, unmount } = await renderPaywall({ trialAvailable: false });
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes("Subscribe"),
  );
  expect(button).toBeDefined();
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not open billing");
  expect(button?.disabled).toBe(false);
  await unmount();
});

it("does not offer billing actions to a non-manager", async () => {
  const { container, unmount } = await renderPaywall({ canManage: false });
  expect(container.querySelector("h1")?.textContent).toBe("Subscription required");
  expect(container.querySelector('button[type="submit"]')).toBeNull();
  expect(container.textContent).not.toContain("Subscribe");
  expect(container.textContent).not.toContain("free trial");
  expect(container.textContent).not.toContain("Manage billing");
  expect(container.textContent).toContain("Log out");
  await unmount();
});

it("offers Subscribe when the price is missing", async () => {
  const { container, unmount } = await renderPaywall({ price: null, trialAvailable: false });
  expect(container.querySelector("h1")?.textContent).toBe("Subscription required");
  expect(container.textContent).toContain("Subscribe");
  await unmount();
});

it("shows an error when opening the billing portal fails", async () => {
  portal.mockRejectedValueOnce(new Error("offline"));
  const { container, unmount } = await renderPaywall({
    hasCustomer: true,
    state: "canceled",
  });
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes("Manage billing"),
  );
  expect(button).toBeDefined();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not open billing");
  await unmount();
});
