// @vitest-environment jsdom

import type { DataRoomConsentStatus } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  cn: (...names: unknown[]) => names.filter(Boolean).join(" "),
}));
vi.mock("../../lib/user-error", () => ({ errorText: () => "Something went wrong" }));
const legal = vi.hoisted(() => ({
  consent: vi.fn(),
  consentGrant: vi.fn(),
  scanNow: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { legal } }));

import { LEGAL_CONSENT_GRANTED, LegalPanelConsent } from "./ConsentPrompt";

const status = (over: Partial<DataRoomConsentStatus> = {}): DataRoomConsentStatus => ({
  key: "k1",
  version: "v1",
  allowed: false,
  disclosure: "",
  recipients: [{ name: "Example Model", detail: "example/model" }],
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("offers Allow in the agent panel, tells the page to scan", async () => {
  legal.consent.mockResolvedValue(status());
  legal.consentGrant.mockResolvedValue(status({ allowed: true }));
  legal.scanNow.mockResolvedValue({ runId: "r1", botId: "b1" });
  const refocus = vi.fn();
  window.addEventListener(LEGAL_CONSENT_GRANTED, refocus);
  await act(async () => root.render(<LegalPanelConsent />));
  expect(container.textContent).toContain("Let Praci read your documents");
  await act(async () => container.querySelector("button")?.click());
  window.removeEventListener(LEGAL_CONSENT_GRANTED, refocus);
  expect(legal.consentGrant).toHaveBeenCalledWith({ key: "k1", version: "v1" });
  expect(legal.scanNow).not.toHaveBeenCalled();
  expect(refocus).toHaveBeenCalledTimes(1);
  expect(container.textContent).toBe("");
});

it("shows nothing when already allowed or when no model is set up", async () => {
  legal.consent.mockResolvedValue(status({ allowed: true }));
  await act(async () => root.render(<LegalPanelConsent />));
  expect(container.textContent).toBe("");
  legal.consent.mockResolvedValue(status({ recipients: [] }));
  await act(async () => root.render(<LegalPanelConsent key="again" />));
  expect(container.textContent).toBe("");
});
