// @vitest-environment jsdom

import type { EquityAccessView } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const requestPortalAccess = vi.hoisted(() => vi.fn());
vi.mock("../../lib/portal", () => ({ requestPortalAccess }));

import { PortalHoldings } from "./PortalHoldings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const view: EquityAccessView = {
  level: "restricted",
  fairMarketValue: null,
  personal: {
    stakeholderId: "s1",
    name: "Avery Sample",
    holdings: [
      {
        kind: "certificate",
        label: "CS-4",
        shareClassName: "Common",
        quantity: "120000",
        principalCents: null,
        issueDate: "2022-03-01",
      },
    ],
  },
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  requestPortalAccess.mockReset().mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("shows only the sections the level returned", async () => {
  await act(async () => root.render(<PortalHoldings view={view} />));
  expect(host.textContent).toContain("CS-4");
  expect(host.textContent).toContain("120,000");
  // Dates read as on the company's own tabs.
  expect(host.textContent).toContain("Mar 1, 2022");
  expect(host.textContent).not.toContain("2022-03-01");
  expect(host.querySelector('[aria-label="Cap table"]')).toBeNull();
  expect(host.querySelector('[aria-label="Holders"]')).toBeNull();
});

it("shows convertible principal with its cents", async () => {
  const withNote: EquityAccessView = {
    ...view,
    personal: {
      ...view.personal!,
      holdings: [
        {
          kind: "convertible",
          label: "SAFE-1",
          shareClassName: null,
          quantity: null,
          principalCents: "123456",
          issueDate: "2022-03-01",
        },
      ],
    },
  };
  await act(async () => root.render(<PortalHoldings view={withNote} />));
  expect(host.textContent).toContain("$1,234.56");
});

it("renders nothing without access", async () => {
  await act(async () => root.render(<PortalHoldings view={{ level: "none" }} />));
  expect(host.textContent).toBe("");
});

it("asks for a higher level", async () => {
  await act(async () => root.render(<PortalHoldings view={view} />));
  const select = host.querySelector('[aria-label="Request access"]') as HTMLSelectElement;
  expect([...select.options].map((o) => o.value)).toEqual(["", "full_detail", "advanced", "basic"]);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
      select,
      "basic",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === "Request")!;
  await act(async () => button.click());
  expect(requestPortalAccess).toHaveBeenCalledWith("basic");
  expect(host.textContent).toContain("Requested");
});

it("does not list the holder again among the other holders", async () => {
  const full: EquityAccessView = {
    ...view,
    level: "full_detail",
    holders: [
      { stakeholderId: "s1", name: "Avery Sample", holdings: view.personal!.holdings },
      { stakeholderId: "s2", name: "Blue Example Fund", holdings: view.personal!.holdings },
    ],
  };
  await act(async () => root.render(<PortalHoldings view={full} />));
  const holders = host.querySelector('[aria-label="Holders"]')!.textContent ?? "";
  expect(holders).toContain("Blue Example Fund");
  expect(holders).not.toContain("Avery Sample");
});

it("shows a waiting request instead of asking again", async () => {
  await act(async () =>
    root.render(<PortalHoldings view={{ ...view, requestedLevel: "basic" }} />),
  );
  expect(host.textContent).toContain("Requested Basic access");
  expect(host.querySelector('[aria-label="Request access"]')).toBeNull();
});
