// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { mockCatalog, mockIntegrations } from "../../stories/fixtures";

vi.mock("../../lib/rpc", () => ({ rpc: {} }));
vi.mock("../../lib/desktop", () => ({
  desktopBridge: () => undefined,
  signInWithSystemBrowser: vi.fn(),
}));
vi.mock("./IntegrationSetup", () => ({ IntegrationSetup: () => <p>setup form</p> }));
vi.mock("./ConnectAppDialog", () => ({
  ConnectAppDialog: ({ item }: { item: { name: string } }) => <p>dialog {item.name}</p>,
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { ConnectAppsStep } from "./ConnectAppsStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<() => void> = [];
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

function render(onDone = vi.fn(), data = mockIntegrations()) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<ConnectAppsStep data={data} setup={null} onDone={onDone} />));
  mounted.push(() => act(() => root.unmount()));
  return host;
}
const button = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll("button")].find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );

it("lists popular apps, hides the provider choices, and skips", () => {
  const onDone = vi.fn();
  const host = render(onDone);
  expect(host.textContent).toContain("Connect your apps");
  // Catalog has Slack, Notion and GitHub; Google apps are not there, so they offer setup.
  expect(button(host, "Connect Slack")).toBeTruthy();
  expect(button(host, "Set up Gmail")).toBeTruthy();
  expect(host.querySelector("details")?.open).toBe(false);
  expect(button(host, "Continue")).toBeUndefined();
  act(() => button(host, "Skip for now")?.click());
  expect(onDone).toHaveBeenCalledTimes(1);
});

it("opens the other ways to connect for an app that needs a provider", () => {
  const host = render();
  act(() => button(host, "Set up Gmail")?.click());
  expect(host.querySelector("details")?.open).toBe(true);
});

it("offers Continue once an app is connected", () => {
  const onDone = vi.fn();
  const slack = mockCatalog[0]!;
  const host = render(
    onDone,
    mockIntegrations({
      connections: [
        {
          id: "c1",
          connectorId: slack.connectorId,
          provider: slack.slug,
          displayName: "Slack",
          status: "connected",
          error: null,
          capabilities: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  );
  expect(host.textContent).toContain("Connected");
  act(() => button(host, "Continue")?.click());
  expect(onDone).toHaveBeenCalledTimes(1);
});

it("filters the list from one search field", () => {
  const host = render();
  const input = host.querySelector("input") as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      "demo crm",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).toContain("Demo CRM");
  expect(host.textContent).not.toContain("Slack");
});
