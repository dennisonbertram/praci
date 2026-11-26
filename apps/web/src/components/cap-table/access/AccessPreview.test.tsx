// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetHideAmountsMemory, setHideAmounts } from "../../../lib/hide-amounts-preference";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const get = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { accessView: { get } } } }));
vi.mock("../../../lib/portal", () => ({ requestPortalAccess: vi.fn() }));

import { AccessPreview } from "./AccessPreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  get.mockReset().mockImplementation(async (input: { level?: string }) =>
    input.level === "none"
      ? { level: "none" }
      : {
          level: input.level ?? "restricted",
          fairMarketValue: { pricePerShare: "12.50", effectiveDate: "2024-01-01" },
          estimatedValue: {
            pricePerShare: "12.50",
            effectiveDate: "2024-01-01",
            valueCents: "50000000",
          },
          shareClasses: [
            {
              name: "Common",
              prefix: "CS",
              classType: "common",
              originalIssuePrice: "1.25",
              conversionRatio: "1",
              liquidationMultiple: "1",
              participating: false,
              seniority: 1,
            },
          ],
          personal: {
            stakeholderId: "s3",
            name: "Casey Placeholder",
            holdings: [
              {
                kind: "option",
                label: "ES-3",
                shareClassName: "Common",
                quantity: "40000",
                principalCents: null,
                issueDate: "2024-02-01",
              },
              {
                kind: "convertible",
                label: "SAFE-1",
                shareClassName: null,
                quantity: null,
                principalCents: "123456",
                issueDate: "2024-02-01",
              },
            ],
          },
        },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetHideAmountsMemory();
});

it("shows the holder's own level, then the level picked, without the request control", async () => {
  await act(async () =>
    root.render(
      <AccessPreview stakeholderId="s3" name="Casey" open onOpenChange={() => undefined} />,
    ),
  );
  expect(get).toHaveBeenCalledWith({ stakeholderId: "s3" });
  expect(document.body.textContent).toContain("ES-3");
  expect(document.querySelector('[aria-label="Request access"]')).toBeNull();
  const select = document.querySelector('[aria-label="Level"]') as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
      select,
      "none",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(get).toHaveBeenLastCalledWith({ stakeholderId: "s3", level: "none" });
  expect(document.body.textContent).toContain("No access");
});

it("applies the founder's Hide amounts preference only to the preview's money values", async () => {
  setHideAmounts(true);
  await act(async () =>
    root.render(
      <AccessPreview stakeholderId="s3" name="Casey" open onOpenChange={() => undefined} />,
    ),
  );

  expect(document.body.textContent).toContain("40,000");
  expect(document.body.textContent).toContain("ES-3");
  expect(document.body.textContent).toContain("$•••");
  expect(document.body.textContent).not.toContain("$500,000");
  expect(document.body.textContent).not.toContain("$12.50");
  expect(document.body.textContent).not.toContain("$1.25");
  expect(document.body.textContent).not.toContain("$1,234.56");
  expect(document.body.textContent).toContain("Jan 1, 2024");

  // The actual holder component keeps its default behavior because the preference is
  // passed only by the founder's preview.
  const { PortalHoldings } = await import("../../../pages/portal/PortalHoldings");
  const holderView = await get({ stakeholderId: "s3" });
  await act(async () => root.render(<PortalHoldings view={holderView} />));
  expect(host.textContent).toContain("$500,000");
  expect(host.textContent).toContain("$12.50");
  expect(host.textContent).toContain("$1.25");
  expect(host.textContent).toContain("$1,234.56");
});
